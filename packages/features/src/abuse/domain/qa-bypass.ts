/**
 * The automated QA suite's bypass of the human check (QA_BYPASS=on): a request that names
 * an address in the QA mail domain and carries the QA token in this header skips Turnstile,
 * and only Turnstile. docs/guides/how-to-configure-abuse-protection.md#qa-bypass
 */
export const QA_TOKEN_HEADER = "x-qa-token";

/** The bypass of one environment: the shared secret and the only mail domain it covers. */
export interface QaBypassSettings {
  readonly token: string;
  /** Lowercase hostname, e.g. `qa.flooper.me`; subdomains of it are not covered. */
  readonly emailDomain: string;
}

/** Why a request that carried the QA header still goes through the human check. */
export type QaBypassRejection = "wrong_token" | "wrong_domain";

/** RFC 5321's limit on a deliverable address; longer ones are never QA addresses. */
export const MAX_EMAIL_LENGTH = 254;

/**
 * The local part of a QA address: the QA inbox's mailbox `qa`, with an optional
 * subaddress (`qa+<tag>`, RFC 5233), which Email Routing delivers to the `qa@` rule.
 */
const QA_LOCAL_PART = /^qa(?:\+[a-z0-9][a-z0-9._-]{0,63})?$/;

/**
 * Whether `email` is an address the QA inbox receives: `qa@<domain>` or
 * `qa+<tag>@<domain>` directly in `domain` (not `qa@x.qa.example.com`, not
 * `someone@qa.example.com`, not `qa.example.com@elsewhere`). Case-insensitive. Pass the
 * address exactly as the request names it, never a shortened copy: a truncated
 * `…@qa.example.com.attacker.example` would look like a QA address.
 */
export function isQaEmail(email: string | null, domain: string): boolean {
  if (!email) return false;
  const address = email.trim().toLowerCase();
  if (address.length > MAX_EMAIL_LENGTH) return false;
  const at = address.lastIndexOf("@");
  if (at <= 0 || address.indexOf("@") !== at) return false;
  return (
    QA_LOCAL_PART.test(address.slice(0, at)) &&
    address.slice(at + 1) === domain.toLowerCase()
  );
}
