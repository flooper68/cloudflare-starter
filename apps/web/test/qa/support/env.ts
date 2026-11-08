/**
 * STUB: the QA infrastructure PR replaces this file. Kept to the agreed contract only:
 * `qaEnv()` and `qaAddress(runId, role)`. Journeys never read process.env themselves.
 */

export interface QaEnv {
  /** The environment's origin, e.g. https://starter.flooper.me. */
  readonly baseUrl: string;
  /** Sent as X-QA-Token on app-origin requests (the Turnstile bypass). */
  readonly qaToken: string;
  /** The test inbox the app's mail to `@<emailDomain>` lands in. */
  readonly inboxUrl: string;
  readonly inboxToken: string;
  /** Every QA address is `qa-…@<emailDomain>`; nothing outside it is ever touched. */
  readonly emailDomain: string;
}

const VARS = {
  baseUrl: "QA_BASE_URL",
  qaToken: "QA_TOKEN",
  inboxUrl: "QA_INBOX_URL",
  inboxToken: "QA_INBOX_TOKEN",
  emailDomain: "QA_EMAIL_DOMAIN",
} as const;

/** The QA environment, or an error naming every missing variable. */
export function qaEnv(): QaEnv {
  const missing = Object.values(VARS).filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`QA environment not set: ${missing.join(", ")}`);
  }
  const read = (name: string) => process.env[name] as string;
  return {
    baseUrl: new URL(read(VARS.baseUrl)).origin,
    qaToken: read(VARS.qaToken),
    inboxUrl: read(VARS.inboxUrl),
    inboxToken: read(VARS.inboxToken),
    emailDomain: read(VARS.emailDomain),
  };
}

/** `qa-<runId>-<role>@<emailDomain>`: the run's address for one role. */
export function qaAddress(runId: string, role: string): string {
  return `qa-${runId}-${role}@${qaEnv().emailDomain}`;
}
