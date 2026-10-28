/**
 * `bun run setup:secrets [--env local|develop|staging|production] [--dry-run]`
 *
 * Asks for the web app's secrets one by one and stores them:
 *  - local: apps/web/.dev.vars (gitignored, mode 600);
 *  - an environment: Worker secrets via `wrangler secret bulk` (JSON on stdin, never in
 *    arguments or files). Note that this deploys a new version with the secrets.
 * Press Enter to skip a value (keep what is there). BETTER_AUTH_SECRET is generated
 * when left empty, and an existing local one is never rotated.
 */
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";

import {
  ask,
  type Environment,
  envFlag,
  fail,
  parseEnvironments,
  readDevVars,
  wrangler,
  writeDevVars,
} from "./lib";

const { values } = parseArgs({
  options: {
    env: { type: "string", default: "local" },
    "dry-run": { type: "boolean", default: false },
  },
});
const dryRun = values["dry-run"] ?? false;
const target = values.env as string;
const local = target === "local";
const existing = local ? readDevVars() : new Map<string, string>();

/** Cloudflare's published always-pass test secret; accepts only the test widget's token. */
const TURNSTILE_TEST_SECRET = "1x0000000000000000000000000000000AA";

interface Secret {
  readonly name: string;
  readonly prompt: string;
  readonly hidden?: boolean;
  readonly fallback?: () => string | undefined;
}

const SECRETS: readonly Secret[] = [
  {
    name: "APP_URL",
    prompt: "Public URL of the app, no trailing slash",
    fallback: () => (local ? "http://localhost:4321" : undefined),
  },
  {
    name: "BETTER_AUTH_SECRET",
    prompt: "Better Auth secret (32+ chars; Enter generates one)",
    hidden: true,
    fallback: () =>
      local && existing.get("BETTER_AUTH_SECRET")
        ? undefined
        : randomBytes(32).toString("base64"),
  },
  {
    name: "TURNSTILE_SECRET_KEY",
    prompt:
      "Turnstile secret key (required with TURNSTILE=on; Enter locally uses Cloudflare's always-pass test secret)",
    hidden: true,
    fallback: () =>
      local && !existing.get("TURNSTILE_SECRET_KEY")
        ? TURNSTILE_TEST_SECRET
        : undefined,
  },
  { name: "GOOGLE_CLIENT_ID", prompt: "Google OAuth client id (optional)" },
  {
    name: "GOOGLE_CLIENT_SECRET",
    prompt: "Google OAuth client secret (optional)",
    hidden: true,
  },
  {
    name: "R2_ACCOUNT_ID",
    prompt: "R2 account id, for presigned URLs (optional)",
  },
  { name: "R2_ACCESS_KEY_ID", prompt: "R2 access key id (optional)" },
  {
    name: "R2_SECRET_ACCESS_KEY",
    prompt: "R2 secret access key (optional)",
    hidden: true,
  },
  {
    name: "R2_FILES_BUCKET_NAME",
    prompt: "R2 bucket for presigned URLs (optional)",
  },
];

const collected: Record<string, string> = {};
console.log(
  `Secrets for ${local ? "local dev (apps/web/.dev.vars)" : `environment ${target}`}.`
);
for (const secret of SECRETS) {
  const current = existing.get(secret.name);
  const hint = current ? (secret.hidden ? " [set]" : ` [${current}]`) : "";
  const answer = dryRun
    ? ""
    : await ask(`${secret.name}: ${secret.prompt}${hint}\n> `, secret.hidden);
  const value = answer || secret.fallback?.();
  if (value) collected[secret.name] = value;
}

if (collected.BETTER_AUTH_SECRET && collected.BETTER_AUTH_SECRET.length < 32) {
  fail("BETTER_AUTH_SECRET must be at least 32 characters");
}

const names = Object.keys(collected);
if (dryRun) {
  console.log(`(dry run) would store: ${names.join(", ") || "nothing"}`);
} else if (local) {
  // APP_ENV=local marks local development: the only place auth links may be logged.
  writeDevVars({ APP_ENV: "local", ...collected });
  console.log(`✓ apps/web/.dev.vars: ${["APP_ENV", ...names].join(", ")}`);
} else {
  const [env] = parseEnvironments(target) as [Environment];
  if (names.length === 0) {
    console.log("Nothing to store.");
  } else {
    const result = wrangler(["secret", "bulk", ...envFlag(env)], {
      input: JSON.stringify(collected),
    });
    if (!result.ok) fail(result.stderr || result.stdout);
    console.log(`✓ Worker secrets (${env}): ${names.join(", ")}`);
  }
}
