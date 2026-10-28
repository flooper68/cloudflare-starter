/**
 * Human verification port (a CAPTCHA-like check). The browser solves a challenge and sends
 * a token; the server asks the verifier whether the token is valid for this action.
 * Adapters: cloudflare (Turnstile Siteverify), noop (always passes), memory (one token
 * passes).
 */

export interface HumanVerificationInput {
  /** The token the widget produced; null when the request carried none. */
  readonly token: string | null;
  /** The client IP, passed on to the provider as a signal. */
  readonly remoteIp: string | null;
  /** What the token is for (`sign-up`, `sign-in`, `password-reset`). */
  readonly action: string;
}

/**
 * `missing`: no token; `rejected`: the provider said no (invalid, expired, reused, wrong
 * action); `unavailable`: the provider could not answer (timeout, network, 5xx). All
 * three refuse the request: the check fails closed.
 */
export type HumanVerificationFailure = "missing" | "rejected" | "unavailable";

export type HumanVerificationResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: HumanVerificationFailure;
      /** Why the provider could not answer (`unavailable` only), for the error report. */
      readonly detail?: string;
    };

export interface HumanVerifier {
  verify(input: HumanVerificationInput): Promise<HumanVerificationResult>;
}
