import type { AccountAuthGateway } from "@cloudflare-starter/features";
import type { BrowserExchange } from "./admin-auth-gateway";
import type { Auth } from "./auth";

/** Credentials never leave this adapter. The use case checks session id + current user. */
export function createAccountAuthGateway(
  auth: () => Auth,
  browser: BrowserExchange | null
): AccountAuthGateway {
  return {
    async revokeSession(token) {
      if (browser) {
        const result = await auth().api.revokeSession({
          body: { token },
          headers: browser.headers,
          returnHeaders: true,
        });
        for (const cookie of result.headers.getSetCookie())
          browser.resHeaders.append("set-cookie", cookie);
      } else {
        // MCP authenticates an OAuth access token, not a browser cookie. As in the admin
        // gateway, the internal adapter preserves auth hooks/cache invalidation.
        await (await auth().$context).internalAdapter.deleteSession(token);
      }
    },
  };
}
