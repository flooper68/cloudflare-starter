/**
 * Pure decisions of `setup:email`: whether Email Sending still has to be enabled for a
 * domain, and how to read the result of `wrangler email sending enable`. No I/O, tested
 * in email-plan.test.ts.
 *
 * Enabling a domain that is already onboarded fails with "Subdomain already exists
 * [code 2040]"; the script must treat that as done and still write EMAIL_FROM and the
 * binding's allowed_sender_addresses.
 */

export interface CommandResult {
  readonly ok: boolean;
  readonly stdout: string;
  readonly stderr: string;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * True when the output of `wrangler email sending list <domain>` names the domain itself
 * (a whole token, so `mail.example.com` does not count for `example.com`).
 */
export function listsSendingDomain(
  listOutput: string,
  domain: string
): boolean {
  const token = new RegExp(
    `(^|[\\s"'\`|│,:])${escapeRegExp(domain.toLowerCase())}\\.?($|[\\s"'\`|│,])`,
    "m"
  );
  return token.test(listOutput.toLowerCase());
}

/** Wrangler's answer when sending is already on for the (sub)domain. */
export function isAlreadyEnabledError(output: string): boolean {
  return /code[:\s]*2040\b|subdomain already exists|already (enabled|exists)/i.test(
    output
  );
}

export type EnablePlan = "already-enabled" | "enable";

/** Decides from `email sending list <domain>` whether `enable` still has to run. */
export function planEnable(list: CommandResult, domain: string): EnablePlan {
  return list.ok && listsSendingDomain(list.stdout, domain)
    ? "already-enabled"
    : "enable";
}

export type EnableOutcome =
  | { readonly status: "enabled" }
  | { readonly status: "already-enabled" }
  | { readonly status: "failed"; readonly message: string };

/** Reads the result of `email sending enable <domain>`. */
export function enableOutcome(result: CommandResult): EnableOutcome {
  if (result.ok) return { status: "enabled" };
  const output = `${result.stderr}\n${result.stdout}`;
  if (isAlreadyEnabledError(output)) return { status: "already-enabled" };
  return {
    status: "failed",
    message: (result.stderr || result.stdout).trim() || "wrangler failed",
  };
}
