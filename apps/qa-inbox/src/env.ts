/** Bindings, vars and secrets of the QA inbox Worker (wrangler.jsonc). */
export interface InboxEnv {
  readonly INBOX: D1Database;
  /** The only mail domain stored, e.g. `qa.flooper.me`. */
  readonly QA_EMAIL_DOMAIN?: string;
  /** Secret: the bearer token of the HTTP API (32+ characters). */
  readonly QA_INBOX_TOKEN?: string;
}

/** Messages are kept this long; reads never return older ones and the cron deletes them. */
export const RETENTION_MS = 24 * 60 * 60 * 1000;

/** Larger mails are refused (nothing the app sends comes close). */
export const MAX_MESSAGE_BYTES = 1024 * 1024;

/** At most this many messages per read, newest first. */
export const MAX_RESULTS = 50;

/** QA_INBOX_TOKEN must be at least this long, or the API refuses everyone. */
export const TOKEN_MIN_LENGTH = 32;
