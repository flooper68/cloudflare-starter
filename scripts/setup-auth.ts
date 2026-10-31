/**
 * `bun run setup:auth [--env develop|staging|production|all] [--dry-run]`
 *
 * Asks for the workspace and sign-up settings and writes them as vars into
 * apps/web/wrangler.jsonc for the chosen environments (none of them is a secret):
 *  - WORKSPACE_MODE: personal | single | multi
 *  - SIGN_UP: open | invite
 *  - SIGN_UP_DOMAINS: email domains that may sign up without an invitation
 *  - BOOTSTRAP_ADMIN_EMAIL: may always sign up; owns the workspace in single mode, and
 *    becomes a platform admin once verified
 *  - ADMIN_PORTAL: on | off: the admin portal (/admin, admin_* MCP tools) for role=admin
 *  - BILLING: off | manual | provider (docs/guides/how-to-configure-plans-and-billing.md)
 * Press Enter to keep the current value. The answers are checked with the same rules the
 * app applies at startup. Deploy afterwards for the change to take effect.
 * docs/guides/how-to-configure-workspaces.md, docs/guides/how-to-use-admin-portal.md
 */
import { parseArgs } from "node:util";

import { securitySettingsSchema } from "../packages/features/src/accounts/domain/security-policy";
import { billingSettingsSchema } from "../packages/features/src/billing/domain/settings";
import { workspaceSettingsSchema } from "../packages/features/src/workspaces/domain/config";
import {
  ask,
  envBlock,
  envPath,
  fail,
  parseEnvironments,
  readWranglerConfig,
  setWranglerValue,
} from "./lib";

const { values } = parseArgs({
  options: {
    env: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});
const dryRun = values["dry-run"] ?? false;
const environments = parseEnvironments(values.env);

interface Setting {
  readonly name: string;
  readonly prompt: string;
}

const SETTINGS: readonly Setting[] = [
  {
    name: "TWO_FACTOR",
    prompt: "Second factor: off, optional, required-for-admins or required",
  },
  {
    name: "TWO_FACTOR_EMAIL_OTP",
    prompt: "Email recovery codes: on or off (requires configured email)",
  },
  {
    name: "TWO_FACTOR_TRUSTED_DEVICE_DAYS",
    prompt: "Remembered device days, 0 to 30; 0 disables",
  },
  { name: "PASSKEYS", prompt: "Passkey sign-in: on or off" },
  {
    name: "WORKSPACE_MODE",
    prompt:
      "How users are grouped: personal (own workspace each), single (one workspace for the app), multi (create and join workspaces)",
  },
  {
    name: "SIGN_UP",
    prompt:
      "Who may create an account: open (anyone) or invite (invitees and the rules below)",
  },
  {
    name: "SIGN_UP_DOMAINS",
    prompt:
      "Email domains that may sign up without an invitation, comma separated (blank for none)",
  },
  {
    name: "BOOTSTRAP_ADMIN_EMAIL",
    prompt:
      "Email that may always sign up; owns the workspace in single mode and becomes an admin once verified (blank for none)",
  },
  {
    name: "ADMIN_PORTAL",
    prompt:
      "Admin portal (/admin and the admin_* MCP tools) for users with role=admin: on or off",
  },
  {
    name: "BILLING",
    prompt:
      "Plans and limits: off (everything unlimited), manual (an admin assigns plans) or provider (online checkout; needs a provider adapter in apps/web/src/server/billing-provider.ts)",
  },
];

/** ADMIN_PORTAL is required and checked on its own; the rest by workspaceSettingsSchema. */
const ADMIN_PORTAL_VALUES = ["on", "off"];

const config = readWranglerConfig();
for (const env of environments) {
  const vars = (envBlock(config, env).vars ?? {}) as Record<string, string>;
  console.log(`\nWorkspaces and sign-up for ${env}:`);
  const next: Record<string, string> = {};
  for (const setting of SETTINGS) {
    const current = vars[setting.name] ?? "";
    const answer = dryRun
      ? ""
      : await ask(`${setting.name}: ${setting.prompt} [${current}]\n> `);
    // "-" clears an optional value; Enter keeps the current one.
    next[setting.name] = answer === "-" ? "" : answer || current;
  }

  if (
    dryRun &&
    !next.WORKSPACE_MODE &&
    !next.SIGN_UP &&
    !next.BILLING &&
    !next.ADMIN_PORTAL
  ) {
    // wrangler.jsonc ships no choice; the real run asks for it.
    console.log(
      `  (dry run) ${env}: WORKSPACE_MODE, SIGN_UP, BILLING and ADMIN_PORTAL are not set yet; the real run asks for them`
    );
    continue;
  }

  if (!ADMIN_PORTAL_VALUES.includes(next.ADMIN_PORTAL ?? "")) {
    fail(`${env}: ADMIN_PORTAL must be on or off (no default)`);
  }
  const { ADMIN_PORTAL: _portal, ...workspaceVars } = next;
  const parsed = workspaceSettingsSchema.safeParse(
    Object.fromEntries(
      Object.entries(workspaceVars).map(([key, value]) => [
        key,
        value || undefined,
      ])
    )
  );
  if (!parsed.success) {
    fail(
      `${env}: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`
    );
  }
  const billing = billingSettingsSchema.safeParse({
    BILLING: next.BILLING || undefined,
  });
  if (!billing.success) {
    fail(
      `${env}: ${billing.error.issues.map((issue) => issue.message).join("; ")}`
    );
  }
  const security = securitySettingsSchema.safeParse(next);
  if (!security.success)
    fail(
      `${env}: ${security.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`
    );
  // The same refusals as apps/web/src/server/auth.ts at startup.
  const unverified =
    vars.AUTH_EMAIL_PASSWORD !== "false" &&
    vars.AUTH_REQUIRE_EMAIL_VERIFICATION !== "true";
  if (unverified && parsed.data.bootstrapAdminEmail) {
    fail(
      `${env}: BOOTSTRAP_ADMIN_EMAIL needs AUTH_REQUIRE_EMAIL_VERIFICATION=true in wrangler.jsonc (or email + password off)`
    );
  }
  if (
    unverified &&
    parsed.data.mode === "single" &&
    parsed.data.signUpDomains.length > 0
  ) {
    fail(
      `${env}: SIGN_UP_DOMAINS in single mode needs AUTH_REQUIRE_EMAIL_VERIFICATION=true in wrangler.jsonc`
    );
  }

  for (const [name, value] of Object.entries(next)) {
    setWranglerValue(envPath(env, "vars", name), value, dryRun);
  }
  console.log(
    `✓ ${env}: WORKSPACE_MODE=${next.WORKSPACE_MODE}, SIGN_UP=${next.SIGN_UP}, BILLING=${next.BILLING}, ADMIN_PORTAL=${next.ADMIN_PORTAL}`
  );
}

console.log(
  dryRun
    ? "\nDry run: nothing was changed."
    : "\nNext: deploy each environment for the settings to take effect. Changing WORKSPACE_MODE on an environment with users is a data migration: read docs/guides/how-to-configure-workspaces.md first."
);
