/** What to tell the user about an unexpected failure that has a reference. */
export const UNEXPECTED_ERROR_MESSAGE =
  "Something went wrong on our side. Try again, or quote the reference when you report it.";

/**
 * The server's reference (request id) of a failed call, for `ErrorState`'s `reference`:
 * tRPC client errors carry it in `data.reference`, JSON error bodies of HTTP routes in
 * `reference`. Undefined for expected errors (validation, not found), which have none.
 */
export function errorReference(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const { data, reference } = error as {
    readonly data?: { readonly reference?: unknown } | null;
    readonly reference?: unknown;
  };
  const value = data?.reference ?? reference;
  return typeof value === "string" && value ? value : undefined;
}
