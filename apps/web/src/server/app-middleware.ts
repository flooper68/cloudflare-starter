/**
 * The body of src/middleware.ts, kept here so API tests can run it without Astro: the
 * request context and x-request-id for every on-demand request, then the cookie session
 * and the /app guard, and the security headers on every response it returns
 * (server/security-headers.ts).
 */
import {
  getSecurityState,
  SecondFactorRequiredError,
  systemClock,
} from "@cloudflare-starter/features";
import type { APIContext } from "astro";
import { buildR2Feature, buildRequiredConfig } from "@/lib/env";
import { AUTH_BASE_PATH, getAuth, MCP_PATH } from "@/server/auth";
import { getDb } from "@/server/db";
import type { AppEnv } from "@/server/env";
import { isHealthPath } from "@/server/health";
import {
  domainErrorResponse,
  withHeaders,
  withRequestContext,
} from "@/server/http";
import { MEDIA_PATH } from "@/server/media";
import { buildPlatform } from "@/server/platform";
import {
  CSP_REPORT_PATH,
  presignedUploadOrigin,
  type SecurityHeaderSettings,
  securityHeadersFor,
} from "@/server/security-headers";

const PROTECTED_PREFIX = "/app";

function isProtected(pathname: string) {
  return (
    pathname === PROTECTED_PREFIX || pathname.startsWith(`${PROTECTED_PREFIX}/`)
  );
}

export type MiddlewareContext = Pick<
  APIContext,
  "request" | "url" | "isPrerendered" | "locals" | "redirect"
> &
  // The matched route template, the `http.route` of the request's span and metric.
  Partial<Pick<APIContext, "routePattern">>;

export interface AppRequestOptions {
  /** `astro dev` (import.meta.env.DEV): the page policy allows Vite's inline modules. */
  readonly dev?: boolean;
}

const DEPLOYED_ENVS: readonly (string | undefined)[] = [
  "develop",
  "staging",
  "production",
];

/** The settings the security headers depend on, read once per env object. */
const headerSettings = new WeakMap<
  AppEnv,
  Omit<SecurityHeaderSettings, "dev">
>();

function securitySettings(env: AppEnv, dev: boolean): SecurityHeaderSettings {
  let settings = headerSettings.get(env);
  if (!settings) {
    const deployed = DEPLOYED_ENVS.includes(env.APP_ENV);
    let platform: ReturnType<typeof buildPlatform>;
    try {
      platform = buildPlatform(env);
    } catch {
      // Misconfigured: the strictest page policy, no third parties. Not cached, so a
      // fixed setting takes effect with the next request.
      return {
        cspMode: null,
        deployed,
        dev,
        turnstile: false,
        webAnalytics: false,
        uploadOrigin: null,
      };
    }
    const r2 = buildR2Feature(env);
    settings = {
      cspMode: platform.cspMode,
      deployed,
      turnstile: platform.turnstile !== null,
      webAnalytics: platform.webAnalytics !== null,
      uploadOrigin: r2.value ? presignedUploadOrigin(r2.value) : null,
    };
    headerSettings.set(env, settings);
  }
  return { ...settings, dev };
}

/**
 * Serves one on-demand request through the app's middleware and adds the security
 * headers to whatever it answers: pages, redirects, API, /mcp, auth, health and errors.
 */
export async function handleAppRequest(
  context: MiddlewareContext,
  env: AppEnv,
  next: () => Promise<Response>,
  options: AppRequestOptions = {}
): Promise<Response> {
  const response = await routeAppRequest(context, env, next);
  return withHeaders(
    response,
    securityHeadersFor(
      context.request,
      response,
      securitySettings(env, options.dev ?? false)
    )
  );
}

async function routeAppRequest(
  context: MiddlewareContext,
  env: AppEnv,
  next: () => Promise<Response>
): Promise<Response> {
  context.locals.user = null;
  context.locals.session = null;

  // Prerendered pages are built once, not served per request: no context, no session.
  if (context.isPrerendered) return next();

  // The health endpoints (server/health.ts) need no session and answer even when a
  // setting is invalid: liveness still passes, readiness reports the setting as failed.
  if (isHealthPath(context.url.pathname)) {
    return withRequestContext(
      context.request,
      env,
      async (scope) => {
        context.locals.requestContext = scope.context;
        return next();
      },
      {
        route: context.routePattern,
        onMisconfigured: async (requestContext) => {
          context.locals.requestContext = requestContext;
          return next();
        },
      }
    );
  }

  // Every response gets x-request-id; unhandled errors become a 500 with a reference.
  return withRequestContext(
    context.request,
    env,
    async (scope) => {
      context.locals.requestContext = scope.context;

      // The auth handler, OAuth discovery, /mcp (bearer tokens, not cookies), the
      // anonymous CSP reports and the public walkthrough media never need the cookie
      // session. /mcp sets the user on its context itself.
      const { pathname } = context.url;
      if (
        pathname.startsWith(AUTH_BASE_PATH) ||
        pathname.startsWith(MEDIA_PATH) ||
        pathname.startsWith("/.well-known/") ||
        pathname === MCP_PATH ||
        pathname === CSP_REPORT_PATH
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

      if (
        result &&
        (isProtected(pathname) ||
          pathname.startsWith("/admin") ||
          pathname === "/consent" ||
          pathname.startsWith("/api/files"))
      ) {
        const security = await getSecurityState(
          { db: getDb(env), clock: systemClock },
          {
            userId: result.user.id,
            sessionId: result.session.id,
            settings: buildRequiredConfig(env).security,
          }
        );
        if (!security.sessionValid) return context.redirect("/sign-in");
        if (security.decision !== "allowed") {
          if (pathname.startsWith("/api/"))
            return domainErrorResponse(
              new SecondFactorRequiredError(
                security.decision === "enrollment_required"
              )
            );
          return context.redirect(
            `/two-factor?next=${encodeURIComponent(pathname + context.url.search)}`
          );
        }
      }
      return next();
    },
    { route: context.routePattern }
  );
}
