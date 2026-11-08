import { createHmac } from "node:crypto";

/**
 * The password of a QA account, generated in code: an HMAC of the address keyed with the
 * QA token, so the suite (and `cleanupRun` in a later process) can sign in again without
 * a password ever being stored, logged, written to a report or typed into the chat. Each
 * address gets its own; knowing one reveals neither the token nor another. Never print it.
 */
export function qaPassword(email: string, token: string): string {
  const digest = createHmac("sha256", token)
    .update(`qa-password:v1:${email.trim().toLowerCase()}`)
    .digest("base64url");
  // Letters of both cases, a digit and a symbol whatever the digest is.
  return `Qa1!${digest}`;
}
