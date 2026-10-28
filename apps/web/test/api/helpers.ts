import { env } from "cloudflare:workers";
import {
  createRequestContext,
  type RequestContext,
  randomIds,
} from "@cloudflare-starter/features";

import { getAuth } from "@/server/auth";
import { createAppContext } from "@/server/trpc/context";
import { appRouter } from "@/server/trpc/router";

export const APP_URL = "http://localhost:4321";

export interface TestUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  /** Session cookie for HTTP requests as this user. */
  readonly cookie: string;
}

/** Signs a user up through Better Auth's real handler, as the browser would. */
export async function signUp(name: string, email: string): Promise<TestUser> {
  const response = await getAuth(env).handler(
    new Request(`${APP_URL}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: APP_URL },
      body: JSON.stringify({ name, email, password: "test-password-1234" }),
    })
  );
  if (!response.ok)
    throw new Error(
      `sign-up failed: ${response.status} ${await response.text()}`
    );
  const body = (await response.json()) as { user: { id: string } };
  const cookie = (response.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
  return { id: body.user.id, email, name, cookie };
}

/** A fresh HTTP request context, as middleware.ts builds it. */
export function testRequestContext(): RequestContext {
  return createRequestContext(
    { ids: randomIds },
    { source: "http", release: "local", environment: "develop" }
  );
}

/** The tRPC router called in-process as this user (or anonymously), like the web endpoint does. */
export function callerFor(
  user: TestUser | null,
  requestContext: RequestContext = testRequestContext()
) {
  return appRouter.createCaller(
    createAppContext(
      user ? { id: user.id, email: user.email, name: user.name } : null,
      requestContext
    )
  );
}
