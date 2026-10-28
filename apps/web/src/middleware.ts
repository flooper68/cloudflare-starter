import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";

import { AUTH_BASE_PATH, getAuth, MCP_PATH } from "@/server/auth";

const PROTECTED_PREFIX = "/app";

function isProtected(pathname: string) {
  return (
    pathname === PROTECTED_PREFIX || pathname.startsWith(`${PROTECTED_PREFIX}/`)
  );
}

export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.user = null;
  context.locals.session = null;

  // Prerendered pages, the auth handler, OAuth discovery and /mcp (bearer tokens,
  // not cookies) never need the cookie session.
  const { pathname } = context.url;
  if (
    context.isPrerendered ||
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

  if (isProtected(context.url.pathname) && !result) {
    return context.redirect("/sign-in");
  }

  return next();
});
