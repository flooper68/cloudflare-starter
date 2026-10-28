/**
 * URLs that carry single-use secrets in the path or query (password reset, email
 * verification, invitations, magic links) must not reach logs. `redactUrlPath` keeps the
 * shape of the path for debugging and replaces the secret parts with `[redacted]`.
 */

/** Path segments whose next segment is a token. */
const TOKEN_BEFORE = new Set([
  "reset-password",
  "verify-email",
  "invite",
  "invites",
  "invitation",
  "invitations",
  "accept-invitation",
  "magic-link",
  "token",
]);

/** Query parameters that hold secrets. */
const SECRET_PARAM = /token|code|secret|password|signature|key/i;

export const REDACTED_SEGMENT = "[redacted]";

/**
 * The path (and query, if present) with token segments and secret query values replaced.
 * Accepts a pathname (`/api/auth/reset-password/abc`) or a path with a query
 * (`/api/auth/verify-email?token=abc`).
 */
export function redactUrlPath(pathAndQuery: string): string {
  const queryAt = pathAndQuery.indexOf("?");
  const path = queryAt === -1 ? pathAndQuery : pathAndQuery.slice(0, queryAt);
  const query = queryAt === -1 ? "" : pathAndQuery.slice(queryAt + 1);

  const segments = path.split("/");
  const redactedPath = segments
    .map((segment, index) => {
      const previous = segments[index - 1];
      return previous !== undefined &&
        TOKEN_BEFORE.has(previous.toLowerCase()) &&
        segment !== ""
        ? REDACTED_SEGMENT
        : segment;
    })
    .join("/");

  if (!query) return redactedPath;
  const redactedQuery = query
    .split("&")
    .map((pair) => {
      const name = pair.split("=")[0] ?? "";
      return SECRET_PARAM.test(decodeSafe(name))
        ? `${name}=${REDACTED_SEGMENT}`
        : pair;
    })
    .join("&");
  return `${redactedPath}?${redactedQuery}`;
}

function decodeSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
