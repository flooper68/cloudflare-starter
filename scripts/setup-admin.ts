/**
 * `bun run setup:admin --email <address> [--demote] [--remote] [--env develop|staging|production] [--dry-run]`
 *
 * Makes an existing account a platform admin (role=admin), or a regular user again with
 * `--demote`, by updating the D1 `user` table through Wrangler, and records the change in
 * the audit log as `user.role_changed` with the system as actor (source `script`).
 * Promoting also lifts a suspension (`user.unbanned`): the way back in when every admin is
 * suspended. The
 * local D1 by default; `--remote` changes the environment's deployed database. The admin
 * portal must be on (ADMIN_PORTAL=on) for the role to open it. The person signs in again
 * (or waits a minute for the cached session) to see the change.
 * docs/guides/how-to-use-admin-portal.md
 */
import { randomBytes, randomUUID } from "node:crypto";
import { parseArgs } from "node:util";

import {
  type Environment,
  envFlag,
  fail,
  parseEnvironments,
  wrangler,
} from "./lib";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    demote: { type: "boolean", default: false },
    remote: { type: "boolean", default: false },
    env: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});

// Strict enough to keep anything but an address out of the SQL below.
const address = values.email?.trim().toLowerCase() ?? "";
if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(address)) {
  fail("Pass the account's address: --email <address>");
}
const email = { data: address };
const environments = parseEnvironments(values.env);
if (environments.length !== 1) fail("Pick one environment with --env");
const env = environments[0] as Environment;
const role = values.demote ? "user" : "admin";
const dryRun = values["dry-run"] ?? false;
const target = values.remote ? ["--remote"] : ["--local"];

/** A SQL string literal (the address is validated as an email above). */
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;

function d1(command: string, options: { readonly dryRun?: boolean } = {}) {
  const result = wrangler(
    [
      "d1",
      "execute",
      "DB",
      ...target,
      ...envFlag(env),
      "--json",
      "--command",
      command,
    ],
    options
  );
  if (!result.ok) {
    fail(`wrangler d1 execute failed:\n${result.stderr || result.stdout}`);
  }
  return result;
}

const where = `lower(email) = ${literal(email.data)}`;
const lookup = d1(`SELECT id, role, banned FROM user WHERE ${where}`);
const rows = (
  JSON.parse(lookup.stdout || "[]") as {
    results?: { id: string; role: string | null; banned: number | null }[];
  }[]
)[0]?.results;
const user = rows?.[0];
if (!user) {
  fail(
    `No account with ${email.data} in the ${values.remote ? "remote" : "local"} ${env} database: sign up first`
  );
}
const previousRole = (user.role ?? "user").split(",").includes("admin")
  ? "admin"
  : "user";
// Promoting is also the way back in when every admin is suspended: it lifts a suspension.
const unban = role === "admin" && user.banned === 1;
if (previousRole === role && !unban) {
  console.log(
    `✓ ${email.data} is already ${role === "admin" ? "an admin" : "a regular user"}`
  );
  process.exit(0);
}

const now = Date.now();
const traceId = randomBytes(16).toString("hex");
/** An audit row as recordAuditEvent writes it (packages/features/src/audit), actor system. */
const auditRow = (action: string, metadata: Record<string, unknown>) =>
  [
    "INSERT INTO audit_events (id, occurred_at, action, outcome, actor_user_id, actor_kind, impersonator_user_id, target_type, target_id, workspace_id, trace_id, source, ip, metadata)",
    `VALUES (${literal(randomUUID())}, ${now}, ${literal(action)}, 'success', NULL, 'system', NULL, 'user', ${literal(user.id)}, NULL, ${literal(traceId)}, 'script', NULL, ${literal(JSON.stringify(metadata))});`,
  ].join(" ");

// One statement batch: the change and its audit events.
d1(
  [
    `UPDATE user SET role = ${literal(role)},${unban ? " banned = 0, ban_reason = NULL, ban_expires = NULL," : ""} updated_at = ${now} WHERE id = ${literal(user.id)};`,
    previousRole === role
      ? ""
      : auditRow("user.role_changed", { previousRole, role }),
    unban ? auditRow("user.unbanned", {}) : "",
  ]
    .filter(Boolean)
    .join(" "),
  { dryRun }
);

console.log(
  dryRun
    ? "\nDry run: nothing was changed."
    : `✓ ${email.data} is now ${role === "admin" ? "an active admin" : "a regular user"} (${values.remote ? "remote" : "local"} ${env}); they sign in again to see it.`
);
