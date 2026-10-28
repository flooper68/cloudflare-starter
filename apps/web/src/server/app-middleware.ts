/**
 * The body of src/middleware.ts, kept here so API tests can run it without Astro: the
 * request context and x-request-id for every on-demand request, then the cookie session
 * and the /app guard.
 */
import type { APIContext } from "astro";

import { AUTH_BASE_PATH, getAuth, MCP_PATH } from "@/server/auth";
import type { AppEnv } from "@/server/env";
import { withRequestContext } from "@/server/http";

const PROTECTED_PREFIX = "/app";

function isProtected(pathname: string) {
  return (
    pathname === PROTECTED_PREFIX || pathname.startsWith(`${PROTECTED_PREFIX}/`)
  );
}

export type MiddlewareContext = Pick<
  APIContext,
  "request" | "url" | "isPrerendered" | "locals" | "redirect"
>;

export async function handleAppRequest(
  context: MiddlewareContext,
  env: AppEnv,
  next: () => Promise<Response>
): Promise<Response> {
  context.locals.user = null;
  context.locals.session = null;

  // Prerendered pages are built once, not served per request: no context, no session.
  if (context.isPrerendered) return next();

  // Every response gets x-request-id; unhandled errors become a 500 with a reference.
  return withRequestContext(context.request, env, async (scope) => {
    context.locals.requestContext = scope.context;

    // The auth handler, OAuth discovery and /mcp (bearer tokens, not cookies) never need
    // the cookie session. /mcp sets the user on its context itself.
    const { pathname } = context.url;
    if (
      pathname.startsWith(AUTH_BASE_PATH) ||
      pathname.startsWith("/.well-known/") ||
      pathname === MCP_PATH
    ) {
      return next();
    }

    const result = await getAuth(env).api.getSession({
      headers: context.request.headers,
    });
    context.locals.user = result?.user ?? null;
    context.locals.session = result?.session ?? null;
    context.locals.requestContext = scope.setUserId(result?.user.id ?? null);

    if (isProtected(pathname) && !result) {
      return context.redirect("/sign-in");
    }

    return next();
  });
}
