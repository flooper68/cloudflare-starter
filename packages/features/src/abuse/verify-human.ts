import type { HumanVerificationFailure, HumanVerifier } from "../platform";

export interface HumanCheckFailure {
  readonly reason: HumanVerificationFailure;
  /** Why the provider could not answer (`unavailable`). */
  readonly detail?: string;
}

import { HumanCheckFailedError, HumanCheckUnavailableError } from "./domain";

/**
 * Asks the human verifier (Turnstile) about a request's token and throws when it is
 * refused: HumanCheckFailedError for a missing or rejected token, HumanCheckUnavailableError
 * when the provider could not answer. Fails closed. `onFailure` sees why, for the audit log
 * and, when the provider was unavailable, the error report.
 */
export async function verifyHuman(
  deps: {
    readonly humanVerifier: HumanVerifier;
    readonly onFailure?: (failure: HumanCheckFailure) => Promise<void>;
  },
  input: {
    readonly token: string | null;
    readonly remoteIp: string | null;
    readonly action: string;
  }
): Promise<void> {
  const result = await deps.humanVerifier.verify(input);
  if (result.ok) return;
  await deps.onFailure?.({
    reason: result.reason,
    ...(result.detail ? { detail: result.detail } : {}),
  });
  throw result.reason === "unavailable"
    ? new HumanCheckUnavailableError()
    : new HumanCheckFailedError();
}
