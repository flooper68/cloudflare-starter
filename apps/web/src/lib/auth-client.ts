import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import { createAuthClient } from "better-auth/react";

/**
 * Better Auth client for the browser; talks to `/api/auth/*` on the same origin.
 * The OAuth provider plugin forwards the signed authorization query when sign-in or
 * consent pages are reached from an MCP client's OAuth flow, so signing in
 * continues that authorization.
 */
export const authClient = createAuthClient({
  plugins: [oauthProviderClient()],
});

export function authErrorMessage(
  error: { readonly message?: string } | null | undefined,
  fallback = "Something went wrong"
): string {
  return error?.message || fallback;
}

/**
 * Where to go after a successful sign-in: the URL Better Auth returns when the
 * sign-in continues an OAuth authorization (MCP clients), else the app.
 */
export function afterSignIn(data: unknown): string {
  const url = (data as { url?: unknown } | null)?.url;
  return typeof url === "string" && url ? url : "/app/dashboard";
}
