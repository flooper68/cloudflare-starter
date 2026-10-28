import { createAuthClient } from "better-auth/react";

/** Better Auth client for the browser; talks to `/api/auth/*` on the same origin. */
export const authClient = createAuthClient();

export function authErrorMessage(
  error: { readonly message?: string } | null | undefined,
  fallback = "Something went wrong"
): string {
  return error?.message || fallback;
}
