/**
 * What the automated QA suite needs from its environment. `bun run test:qa -- --base-url
 * <url>` sets QA_BASE_URL; CI passes the three secrets (docs/guides/how-to-qa-a-deployment.md).
 */
export interface QaEnv {
  /** The deployed app's origin, e.g. https://starter.flooper.me. */
  readonly baseURL: string;
  /** The app's QA_TOKEN secret, sent as X-QA-Token to the app's origin only. */
  readonly token: string;
  /** The QA inbox Worker's origin (cloudflare-starter-qa-inbox on workers.dev). */
  readonly inboxURL: string;
  /** The inbox API's bearer token (its QA_INBOX_TOKEN secret). */
  readonly inboxToken: string;
  /** The mail domain of QA addresses: QA_EMAIL_DOMAIN, default qa.flooper.me. */
  readonly emailDomain: string;
}

const REQUIRED = {
  QA_BASE_URL:
    "the deployed app's URL (bun run test:qa -- --base-url https://starter.flooper.me)",
  QA_TOKEN: "the app's QA_TOKEN secret (X-QA-Token)",
  QA_INBOX_URL:
    "the QA inbox Worker's URL (https://cloudflare-starter-qa-inbox.<account>.workers.dev)",
  QA_INBOX_TOKEN: "the QA inbox's bearer token (its QA_INBOX_TOKEN secret)",
} as const;

/** The default QA mail domain: QA_EMAIL_DOMAIN of the starter's production vars. */
export const DEFAULT_QA_EMAIL_DOMAIN = "qa.flooper.me";

/** Names of the required variables that are unset or blank. */
export function missingQaEnv(
  env: Readonly<Record<string, string | undefined>> = process.env
): string[] {
  return Object.keys(REQUIRED).filter((name) => !env[name]?.trim());
}

/** Why the QA suite cannot run here, for `test.skip`; null when everything is set. */
export function qaSkipReason(
  env: Readonly<Record<string, string | undefined>> = process.env
): string | null {
  const missing = missingQaEnv(env);
  if (missing.length === 0) return null;
  return `QA suite skipped: set ${missing.join(", ")} (${missing
    .map((name) => `${name}: ${REQUIRED[name as keyof typeof REQUIRED]}`)
    .join("; ")}). docs/guides/how-to-qa-a-deployment.md`;
}

function origin(name: string, value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} is not a URL: ${value}`);
  }
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new Error(
      `${name} must be https (http only for localhost): ${value}`
    );
  }
  return url.origin;
}

/**
 * Reads QA_BASE_URL, QA_TOKEN, QA_INBOX_URL and QA_INBOX_TOKEN (and the optional
 * QA_EMAIL_DOMAIN). Throws one error naming every missing variable and what it is.
 * Never puts a token in an error.
 */
export function qaEnv(
  env: Readonly<Record<string, string | undefined>> = process.env
): QaEnv {
  const reason = qaSkipReason(env);
  if (reason) throw new Error(reason.replace("QA suite skipped: ", ""));
  const emailDomain = (
    env.QA_EMAIL_DOMAIN?.trim() || DEFAULT_QA_EMAIL_DOMAIN
  ).toLowerCase();
  return {
    baseURL: origin("QA_BASE_URL", env.QA_BASE_URL as string),
    token: (env.QA_TOKEN as string).trim(),
    inboxURL: origin("QA_INBOX_URL", env.QA_INBOX_URL as string),
    inboxToken: (env.QA_INBOX_TOKEN as string).trim(),
    emailDomain,
  };
}
