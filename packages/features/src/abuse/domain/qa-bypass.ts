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

/**
 * Whether `email` is an address directly in `domain` (`someone@qa.example.com`, not
 * `someone@x.qa.example.com` or `qa.example.com@elsewhere`). Case-insensitive.
 */
export function isQaEmail(email: string | null, domain: string): boolean {
  if (!email) return false;
  const address = email.trim().toLowerCase();
  const at = address.lastIndexOf("@");
  if (at <= 0 || address.indexOf("@") !== at) return false;
  return address.slice(at + 1) === domain.toLowerCase();
}
