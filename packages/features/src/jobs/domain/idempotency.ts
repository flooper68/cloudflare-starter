import type { JobDefinition } from "../../kernel";

/** How long a claim blocks other runs of the same key; after that a stuck run is reclaimed. */
export const IDEMPOTENCY_LOCK_MS = 15 * 60 * 1000;

/** How long a key is kept, and so how long a duplicate is recognised: 7 days. */
export const IDEMPOTENCY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The idempotency key of a job, prefixed with its type so keys of different jobs never
 * collide; undefined for jobs without one.
 */
export function idempotencyKeyFor<TPayload>(
  definition: JobDefinition<TPayload>,
  payload: TPayload
): string | undefined {
  return definition.idempotencyKey
    ? `${definition.type}:${definition.idempotencyKey(payload)}`
    : undefined;
}

/** A new claim at `now`: locked for 15 minutes, purged after 7 days. */
export function claimWindow(now: Date): {
  readonly lockedUntil: Date;
  readonly expiresAt: Date;
} {
  return {
    lockedUntil: new Date(now.getTime() + IDEMPOTENCY_LOCK_MS),
    expiresAt: new Date(now.getTime() + IDEMPOTENCY_RETENTION_MS),
  };
}

/** A key completed at `now` is kept (and blocks duplicates) for 7 days. */
export function completedExpiry(now: Date): Date {
  return new Date(now.getTime() + IDEMPOTENCY_RETENTION_MS);
}
