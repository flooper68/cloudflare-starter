import type { Ids } from "../../../kernel";
import type {
  HumanVerificationInput,
  HumanVerificationResult,
  HumanVerifier,
} from "../../ports";

export const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Turnstile tokens are at most 2048 characters. */
const MAX_TOKEN_LENGTH = 2048;

export interface TurnstileVerifierConfig {
  /** The widget's secret key (TURNSTILE_SECRET_KEY). */
  readonly secretKey: string;
  /** `fetch`, injected so tests answer Siteverify without the network. */
  readonly fetch: typeof fetch;
  /** Makes the idempotency key that lets a retry ask about the same token again. */
  readonly ids: Ids;
  /** Per attempt; the default 5 s with two attempts bounds the wait at about 10 s. */
  readonly timeoutMs?: number;
  /** Attempts in all; the default 2 is one retry. */
  readonly attempts?: number;
}

interface SiteverifyResponse {
  readonly success?: boolean;
  readonly action?: string;
  readonly "error-codes"?: readonly string[];
}

type Attempt =
  | { readonly kind: "answer"; readonly body: SiteverifyResponse }
  | { readonly kind: "retry" };

/** Codes that mean our configuration is wrong, not the visitor's token. */
const CONFIG_ERRORS = new Set(["missing-input-secret", "invalid-input-secret"]);

/**
 * HumanVerifier on Cloudflare Turnstile Siteverify. Fails closed: a timeout, network
 * error, 5xx or `internal-error` is retried once with the same idempotency key, then
 * the check reports `unavailable` (with a `detail` for the caller's error report; the
 * adapter writes nothing itself) and the request is refused.
 */
export function createTurnstileVerifier(
  config: TurnstileVerifierConfig
): HumanVerifier {
  const timeoutMs = config.timeoutMs ?? 5_000;
  const attempts = config.attempts ?? 2;

  async function attempt(body: URLSearchParams): Promise<Attempt> {
    try {
      const response = await config.fetch(SITEVERIFY_URL, {
        method: "POST",
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.status >= 500) return { kind: "retry" };
      const parsed = (await response.json()) as SiteverifyResponse;
      if (parsed["error-codes"]?.includes("internal-error")) {
        return { kind: "retry" };
      }
      return { kind: "answer", body: parsed };
    } catch {
      return { kind: "retry" };
    }
  }

  return {
    async verify(
      input: HumanVerificationInput
    ): Promise<HumanVerificationResult> {
      if (!input.token) return { ok: false, reason: "missing" };
      if (input.token.length > MAX_TOKEN_LENGTH) {
        return { ok: false, reason: "rejected" };
      }

      const body = new URLSearchParams({
        secret: config.secretKey,
        response: input.token,
        idempotency_key: config.ids.uuid(),
      });
      if (input.remoteIp) body.set("remoteip", input.remoteIp);

      for (let index = 0; index < attempts; index++) {
        const result = await attempt(body);
        if (result.kind === "retry") continue;

        const codes = result.body["error-codes"] ?? [];
        if (codes.some((code) => CONFIG_ERRORS.has(code))) {
          return {
            ok: false,
            reason: "unavailable",
            detail: `Siteverify rejected the secret key (${codes.join(", ")}): check TURNSTILE_SECRET_KEY`,
          };
        }
        if (result.body.success !== true) {
          return { ok: false, reason: "rejected" };
        }
        // Test keys answer without an action; real widgets echo the one they rendered with.
        if (result.body.action && result.body.action !== input.action) {
          return { ok: false, reason: "rejected" };
        }
        return { ok: true };
      }

      return {
        ok: false,
        reason: "unavailable",
        detail: `Siteverify did not answer after ${attempts} attempts`,
      };
    },
  };
}
