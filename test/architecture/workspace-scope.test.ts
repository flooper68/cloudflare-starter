/**
 * Tenancy (docs/architecture/overview.md#tenancy-and-authorization): data belongs to a
 * workspace and every access goes through a workspace actor.
 * - Every table has a non-null `workspace_id`, except Better Auth's tables and the
 *   reasoned exemptions below.
 * - Every procedure of a workspace-scoped router is a `workspaceProcedure`
 *   (meta.scope "workspace") unless it acts for the user across workspaces (listed below).
 * - Every workspace procedure is called through `expectCrossWorkspaceDenied` in an API test.
 * - Use cases of workspace-scoped features take `actor: Actor` as their second parameter.
 */
import { basename } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { PROCEDURE_PATHS } from "@/server/mcp/tools";
import { appRouter } from "@/server/trpc/router";

import { filesUnder, read } from "./repo";

/** Tables without `workspace_id`, with the reason. Auth tables are found separately. */
const TABLES_WITHOUT_WORKSPACE: Readonly<Record<string, string>> = {
  workspaces: "the tenant itself; its id is what workspace_id points at",
  user_settings:
    "personal preferences and avatar reference across workspaces; cascades with user",
  audit_events: "platform table; workspace_id optional",
  feature_flags:
    "platform configuration, not tenant data: one switch per flag for the whole deployment",
  feature_flag_rules:
    "platform configuration, not tenant data: a rule may target a workspace by id, but belongs to the flag",
  notifications:
    "user-scoped messages; workspace_id optional; rows cascade with the workspace",
  notification_preferences:
    "a user's own settings across workspaces; rows cascade with the user",
  notification_settings:
    "a user's own settings across workspaces; rows cascade with the user",
  job_idempotency_keys:
    "platform table of the job queue: keys are per job type and payload, the workspace travels in the job envelope",
};

/** Routers whose procedures act inside one workspace. */
const WORKSPACE_ROUTERS = ["storage", "workspace", "flags"] as const;

/** Procedures of those routers that act for the signed-in user, not in one workspace. */
const USER_LEVEL_PROCEDURES: Readonly<Record<string, string>> = {
  "workspace.list": "lists the user's workspaces across all of them",
  "workspace.create": "creates a new workspace; no workspace to act in yet",
  "workspace.invitations.preview":
    "shows a link's invitation to whoever holds the token, before they are a member",
  "workspace.invitations.accept":
    "joins the workspace; the user is not a member until it succeeds",
};

/** Features whose data is workspace-scoped: their use cases take an actor. */
const WORKSPACE_SCOPED_FEATURES = ["billing", "files", "workspaces"] as const;

/** Files in those features that are not actor use cases, with the reason. */
const NO_ACTOR_FILES: Readonly<Record<string, string>> = {
  "workspaces/purge-workspace-logos.ts":
    "runs only after account/workspace deletion authorization, including old image versions",
  "workspaces/find-referenced-logo-keys.ts":
    "system/admin reconciliation reads current image references across workspaces",
  "billing/resolve-entitlements.ts":
    "reads a workspace's billing for the gate and billing use cases, whose callers authorized it",
  "billing/assert-feature.ts":
    "called through the BillingGate by a use case that checked the actor first",
  "billing/assert-limit.ts":
    "called through the BillingGate by a use case that checked the actor first",
  "billing/record-usage.ts":
    "called through the BillingGate by a use case that checked the actor first",
  "billing/measure-metric.ts":
    "measures a workspace for assertLimit and the usage summaries, whose callers authorized it",
  "billing/get-usage-summary.ts":
    "for a member through getBillingSummary or for a platform admin",
  "billing/create-billing-gate.ts": "builds the gate, not a use case",
  "billing/start-trial.ts": "runs when a workspace is created; no actor yet",
  "billing/expire-trials.ts": "daily cron over all workspaces; no actor",
  "billing/apply-subscription-change.ts":
    "the provider's webhook; authenticated by its signature, no actor",
  "billing/assign-plan.ts": "platform admin, not a member of the workspace",
  "billing/set-addons.ts": "platform admin, not a member of the workspace",
  "billing/set-override.ts": "platform admin, not a member of the workspace",
  "billing/get-billing-overview.ts":
    "platform admin overview across all workspaces; no actor",
  "billing/get-workspace-billing.ts":
    "platform admin, not a member of the workspace",
  "files/measure-workspace-storage.ts":
    "billing's storage_bytes metric, for a workspace its caller authorized",
  "workspaces/count-workspace-seats.ts":
    "billing's seats metric, for a workspace its caller authorized",
  "files/r2-presign.ts": "S3 signing helper, not a use case",
  "files/delete-workspace-files.ts":
    "runs during account deletion for workspaces being deleted; no actor exists",
  "workspaces/resolve-actor.ts": "builds the actor",
  "workspaces/list-workspaces.ts": "the user's workspaces across all of them",
  "workspaces/create-workspace.ts": "creates a workspace; no actor yet",
  "workspaces/provision-user.ts": "runs at sign-up, before any membership",
  "workspaces/check-sign-up-allowed.ts": "runs before the user exists",
  "workspaces/prepare-user-deletion.ts":
    "acts on all of a user's memberships during account deletion",
  "workspaces/preview-invitation.ts": "for a token holder who is not a member",
  "workspaces/accept-invitation.ts": "for a user who is not a member yet",
};

const migrationSql = filesUnder("packages/features/migrations", /\.sql$/)
  .map(read)
  .join("\n");

const tables = [
  ...migrationSql.matchAll(/CREATE TABLE `([^`]+)` \(([\s\S]*?)\n\);/g),
].map(([, name, body]) => ({ name: name as string, body: body as string }));

const authTables = [
  ...read("packages/features/src/accounts/accounts.schema.ts").matchAll(
    /sqliteTable\(\s*"([^"]+)"/g
  ),
].map(([, name]) => name as string);

type ProcedureDef = { _def: { meta?: { scope?: string } } };
const procedures = appRouter._def.procedures as unknown as Record<
  string,
  ProcedureDef
>;
const scopedPaths = PROCEDURE_PATHS.filter((path) =>
  WORKSPACE_ROUTERS.some((router) => path.startsWith(`${router}.`))
);

const apiTests = filesUnder("apps/web/test/api", /\.test\.ts$/)
  .map(read)
  .join("\n");

const useCaseFiles = WORKSPACE_SCOPED_FEATURES.flatMap((feature) =>
  filesUnder(
    `packages/features/src/${feature}`,
    /^packages\/features\/src\/[^/]+\/(?!index\.ts$)[^/]+(?<!\.schema|\.test|\.integration\.test)\.ts$/
  )
);

/** The second parameter of the file's exported function: `name: Type`. */
function secondParameter(path: string): string | null {
  const source = ts.createSourceFile(
    path,
    read(path),
    ts.ScriptTarget.Latest,
    true
  );
  for (const statement of source.statements) {
    if (
      ts.isFunctionDeclaration(statement) &&
      ts
        .getModifiers(statement)
        ?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      const parameter = statement.parameters[1];
      return parameter
        ? `${parameter.name.getText(source)}: ${parameter.type?.getText(source) ?? ""}`
        : null;
    }
  }
  return null;
}

describe("workspace scope", () => {
  it("reads the tables from the migrations", () => {
    expect(tables.map((table) => table.name)).toContain("files");
    expect(authTables).toContain("user");
  });

  it.each(
    tables.filter(
      (table) =>
        !authTables.includes(table.name) &&
        !(table.name in TABLES_WITHOUT_WORKSPACE)
    )
  )("table $name has a non-null workspace_id", ({ body }) => {
    expect(
      body,
      "data belongs to a workspace: add workspace_id NOT NULL, or an exemption with a reason"
    ).toMatch(/`workspace_id` text (PRIMARY KEY )?NOT NULL/);
  });

  it("lists only real procedures as user-level", () => {
    expect(
      Object.keys(USER_LEVEL_PROCEDURES).filter(
        (path) => !scopedPaths.includes(path)
      )
    ).toEqual([]);
  });

  it.each(scopedPaths.filter((path) => !(path in USER_LEVEL_PROCEDURES)))(
    "procedure %s is a workspaceProcedure tested across workspaces",
    (path) => {
      expect(
        procedures[path]?._def.meta?.scope,
        "use workspaceProcedure (trpc/init.ts) or list it in USER_LEVEL_PROCEDURES with a reason"
      ).toBe("workspace");
      expect(
        apiTests.includes(`expectCrossWorkspaceDenied("${path}"`),
        `call expectCrossWorkspaceDenied("${path}", …) in apps/web/test/api/`
      ).toBe(true);
    }
  );

  it.each(
    useCaseFiles.filter(
      (path) => !(path.replace("packages/features/src/", "") in NO_ACTOR_FILES)
    )
  )("use case %s takes the actor second", (path) => {
    expect(
      secondParameter(path),
      `${basename(path)}: (deps, actor: Actor, input), or an exemption with a reason`
    ).toBe("actor: Actor");
  });

  it("names only real files as exemptions", () => {
    const known = useCaseFiles.map((path) =>
      path.replace("packages/features/src/", "")
    );
    expect(
      Object.keys(NO_ACTOR_FILES).filter((file) => !known.includes(file))
    ).toEqual([]);
  });
});
