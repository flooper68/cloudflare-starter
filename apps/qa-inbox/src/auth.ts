import { TOKEN_MIN_LENGTH } from "./env";

const encoder = new TextEncoder();

/**
 * Constant-time comparison: always walks every byte of `expected` and folds differences
 * and a length mismatch into one value, so the time taken does not depend on where the
 * presented token goes wrong. (The same rule as `timingSafeEqual` in packages/features,
 * copied so this Worker stays free of the app's code.)
 */
export function timingSafeEqual(presented: string, expected: string): boolean {
  const left = encoder.encode(presented);
  const right = encoder.encode(expected);
  let difference = left.length ^ right.length;
  for (let index = 0; index < right.length; index++) {
    difference |= (left[index] ?? 0) ^ (right[index] as number);
  }
  return difference === 0 && right.length > 0;
}

/**
 * Whether the request carries `Authorization: Bearer <QA_INBOX_TOKEN>`. Fails closed: a
 * missing or too short configured token refuses every request.
 */
export function isAuthorized(
  request: Request,
  configured: string | undefined
): boolean {
  if (!configured || configured.length < TOKEN_MIN_LENGTH) return false;
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer (\S+)$/.exec(header);
  return timingSafeEqual(match?.[1] ?? "", configured);
}
