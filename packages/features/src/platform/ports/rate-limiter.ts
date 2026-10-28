/**
 * Rate limiter port. Callers pass the policy (from the abuse catalog) and the counter key
 * (`limitKey`); the adapter counts and answers. Adapters: cloudflare (Workers Rate
 * Limiting bindings), noop (never limits), memory (fixed windows on an injected clock).
 */

/** What a limiter needs to know about a policy; the abuse catalog's entries fit it. */
export interface RateLimitRule {
  readonly limit: number;
  readonly periodSeconds: number;
  /** The Workers Rate Limiting binding that enforces it (cloudflare adapter). */
  readonly binding?: string;
}

export type RateLimitResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly retryAfterSeconds: number };

export interface RateLimiter {
  /** Counts one request against `key` under `rule`; refuses once the limit is reached. */
  limit(rule: RateLimitRule, key: string): Promise<RateLimitResult>;
}
