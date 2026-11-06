/**
 * `bun run setup:email --domain example.com [--from noreply@example.com] [--name "App"]
 *                      [--env develop|staging|production|all] [--dry-run]`
 *
 * Turns on Cloudflare Email Service sending for a domain (Workers Paid; the domain's DNS
 * must be on Cloudflare), prints the DNS records it needs, and writes EMAIL_FROM,
 * EMAIL_FROM_NAME and the binding's allowed_sender_addresses into wrangler.jsonc for the
 * chosen environments. Deploy afterwards for the change to take effect.
 */
import { parseArgs } from "node:util";

import { enableOutcome, planEnable } from "./email-plan";
import {
  envPath,
  fail,
  parseEnvironments,
  setWranglerValue,
  wrangler,
} from "./lib";

const { values } = parseArgs({
  options: {
    domain: { type: "string" },
    from: { type: "string" },
    name: { type: "string" },
    env: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});
const dryRun = values["dry-run"] ?? false;
const domain =
  values.domain ?? fail("--domain is required, e.g. --domain example.com");
const from = values.from ?? `noreply@${domain}`;
if (!from.endsWith(`@${domain}`) && !from.endsWith(`.${domain}`)) {
  fail(`--from ${from} is not on ${domain}`);
}

console.log(`Email Sending for ${domain}`);
// An onboarded domain makes `enable` fail with "Subdomain already exists [code 2040]":
// check the list first, and treat that error as done too (email-plan.ts).
const listed = wrangler(["email", "sending", "list", domain], { dryRun });
if (!dryRun && planEnable(listed, domain) === "already-enabled") {
  console.log(`✓ Email Sending is already enabled for ${domain}`);
} else {
  const outcome = enableOutcome(
    wrangler(["email", "sending", "enable", domain], { dryRun })
  );
  if (outcome.status === "failed") fail(outcome.message);
  if (!dryRun)
    console.log(
      outcome.status === "already-enabled"
        ? `✓ Email Sending is already enabled for ${domain}`
        : `✓ Email Sending enabled for ${domain}`
    );
}
if (!dryRun) {
  const dns = wrangler(["email", "sending", "dns", "get", domain]);
  console.log(dns.ok ? `\nDNS records:\n${dns.stdout.trim()}` : dns.stderr);
}

for (const env of parseEnvironments(values.env)) {
  setWranglerValue(envPath(env, "vars", "EMAIL_FROM"), from, dryRun);
  if (values.name) {
    setWranglerValue(
      envPath(env, "vars", "EMAIL_FROM_NAME"),
      values.name,
      dryRun
    );
  }
  setWranglerValue(
    envPath(env, "send_email", 0),
    { name: "EMAIL", allowed_sender_addresses: [from] },
    dryRun
  );
  console.log(`✓ ${env}: EMAIL_FROM=${from}`);
}

console.log(
  dryRun
    ? "\nDry run: nothing was changed."
    : "\nNext: deploy the environment, then send a test from /app/email-demo."
);
