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
 * (or waits a minute for the cached session) to see the change. `--dry-run` is offline: it
 * prints the commands and SQL without reading or changing any database.
 * docs/guides/how-to-use-admin-portal.md
 */
import { randomBytes, randomUUID } from "node:crypto";
import { parseArgs } from "node:util";

import { lookupSql, roleChangeSql, userIdSubquery } from "./admin-sql";
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
const where = `${values.remote ? "remote" : "local"} ${env}`;

const d1Args = (command: string) => [
  "d1",
  "execute",
  "DB",
  ...target,
  ...envFlag(env),
  "--json",
  "--command",
  command,
];

function d1(command: string) {
  const result = wrangler(d1Args(command));
  if (!result.ok) {
    fail(`wrangler d1 execute failed:\n${result.stderr || result.stdout}`);
  }
  return result;
}

if (dryRun) {
  // Offline: nothing is read from or written to any database, local or remote.
  const promote = role === "admin";
  console.log(
    [
      `Dry run, ${where} database: nothing is read or changed.`,
      "1. Look the account up:",
      `  wrangler ${d1Args(lookupSql(email.data)).join(" ")}`,
      `2. If its role is not ${role}${promote ? " or it is suspended" : ""}, one batch (ids and time are generated then; only the audit rows that apply):`,
      `  ${roleChangeSql({
        userId: { sql: userIdSubquery(email.data) },
        role,
        previousRole: promote ? "user" : "admin",
        unban: promote,
        now: Date.now(),
        traceId: "<trace id>",
        auditIds: ["<audit id>", "<audit id>"],
      })}`,
      "\nDry run: nothing was changed.",
    ].join("\n")
  );
  process.exit(0);
}

const lookup = d1(lookupSql(email.data));
const rows = (
  JSON.parse(lookup.stdout || "[]") as {
    results?: { id: string; role: string | null; banned: number | null }[];
  }[]
)[0]?.results;
const user = rows?.[0];
if (!user) {
  fail(`No account with ${email.data} in the ${where} database: sign up first`);
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

d1(
  roleChangeSql({
    userId: { literal: user.id },
    role,
    previousRole,
    unban,
    now: Date.now(),
    traceId: randomBytes(16).toString("hex"),
    auditIds: [randomUUID(), randomUUID()],
  })
);

console.log(
  `✓ ${email.data} is now ${role === "admin" ? "an active admin" : "a regular user"} (${where}); they sign in again to see it.`
);
