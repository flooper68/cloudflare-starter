/**
 * The key the readiness probe asks R2 about. Nothing is ever stored under it: the answer
 * (no such object) is the round trip. Outside every workspace prefix, so storage
 * reconciliation never sees it.
 */
const HEALTH_PROBE_KEY = "health/probe";

/**
 * The readiness probe of R2: one `head` of a key that does not exist (a Class B
 * operation, the cheapest). Writes nothing; throws when R2 does not answer.
 */
export async function probeBucket(deps: {
  readonly bucket: R2Bucket;
}): Promise<void> {
  await deps.bucket.head(HEALTH_PROBE_KEY);
}
