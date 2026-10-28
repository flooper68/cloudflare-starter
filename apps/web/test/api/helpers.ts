import { env as workerEnv } from "cloudflare:workers";
import {
  type BillingMode,
  createRequestContext,
  type RequestContext,
  randomIds,
  type WorkspaceMode,
} from "@cloudflare-starter/features";
import { expect } from "vitest";

import { getAuth, HUMAN_CHECK_HEADER } from "@/server/auth";
import type { AppEnv } from "@/server/env";
import { invoke } from "@/server/mcp/tools";
import { type BrowserContext, createAppContext } from "@/server/trpc/context";
import { appRouter } from "@/server/trpc/router";

import { TURNSTILE_DUMMY_TOKEN } from "../outbound";

export const APP_URL = "http://localhost:4321";

/** The Worker's env: WORKSPACE_MODE=multi and SIGN_UP=open from vitest.config.ts bindings. */
export const env = workerEnv as AppEnv;

/**
 * Headers a browser sends to the human-checked auth endpoints: the Turnstile test token
 * (accepted by the always-pass test secret the API tests run with) and a client IP.
 */
export function humanHeaders(ip = "198.51.100.1"): Record<string, string> {
  return {
    [HUMAN_CHECK_HEADER]: TURNSTILE_DUMMY_TOKEN,
    "cf-connecting-ip": ip,
  };
}

export interface TestUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  /** Session cookie for HTTP requests as this user. */
  readonly cookie: string;
}

/** Mail sent through `mailEnv`, newest last. */
export const outbox: { readonly to: unknown; readonly text: string }[] = [];

/** The Worker's env with an EMAIL binding that records mail instead of simulating it. */
export const mailEnv: AppEnv = {
  ...env,
  EMAIL: {
    send: async (message: { to: unknown; text: string }) => {
      outbox.push(message);
    },
  },
};

/** The token from the newest invitation mailed to `email` (through `mailEnv`). */
export function invitationToken(email: string): string {
  const message = outbox.findLast((sent) =>
    JSON.stringify(sent.to).includes(email)
  );
  const token = /\/invite\/([0-9a-f]{64})/.exec(message?.text ?? "")?.[1];
  if (!token) throw new Error(`no invitation mailed to ${email}`);
  return token;
}

/** Invites `email` into the owner's workspace and returns the link's token. */
export async function inviteByMail(
  owner: TestUser,
  workspaceId: string,
  email: string,
  role: "owner" | "member" = "member",
  runtimeEnv: AppEnv = mailEnv
): Promise<string> {
  await callerFor(owner, runtimeEnv).workspace.invitations.create({
    workspaceId,
    email,
    role,
  });
  return invitationToken(email);
}

const envs = new Map<string, AppEnv>();

/**
 * The Worker's env with other workspace settings, for tests of another mode or sign-up
 * policy. One object per combination, so Better Auth's per-env cache is reused. With a
 * BOOTSTRAP_ADMIN_EMAIL, email verification is on unless stated, as the app requires.
 */
export function envWith(vars: {
  readonly WORKSPACE_MODE: WorkspaceMode;
  readonly SIGN_UP?: "open" | "invite";
  readonly SIGN_UP_DOMAINS?: string;
  readonly BOOTSTRAP_ADMIN_EMAIL?: string;
  readonly AUTH_REQUIRE_EMAIL_VERIFICATION?: "true" | "false";
  readonly ADMIN_PORTAL?: "on" | "off";
  readonly BILLING?: BillingMode;
}): AppEnv {
  const key = JSON.stringify(vars);
  let value = envs.get(key);
  if (!value) {
    value = {
      ...mailEnv,
      SIGN_UP: "open",
      ...(vars.BOOTSTRAP_ADMIN_EMAIL
        ? { AUTH_REQUIRE_EMAIL_VERIFICATION: "true" }
        : {}),
      ...vars,
    };
    envs.set(key, value);
  }
  return value;
}

/**
 * Sign-up is rate limited per client IP (5 a minute, as in production). Each sign-up in
 * a test comes from its own documentation-range address, so a file can create the users
 * its scenario needs without weakening the limit.
 */
let nextIp = 0;

/** Posts a sign-up to Better Auth's real handler, as the browser would. */
export function signUpRequest(
  name: string,
  email: string,
  runtimeEnv: AppEnv = env
): Promise<Response> {
  nextIp += 1;
  return getAuth(runtimeEnv).handler(
    new Request(`${APP_URL}/api/auth/sign-up/email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: APP_URL,
        ...humanHeaders(`203.0.113.${nextIp}`),
      },
      body: JSON.stringify({ name, email, password: "test-password-1234" }),
    })
  );
}

/** Signs a user up through Better Auth's real handler and returns them with a session. */
export async function signUp(
  name: string,
  email: string,
  runtimeEnv: AppEnv = env
): Promise<TestUser> {
  const response = await signUpRequest(name, email, runtimeEnv);
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
  runtimeEnv: AppEnv = env,
  requestContext: RequestContext = testRequestContext(),
  browser?: BrowserContext
) {
  return appRouter.createCaller(
    createAppContext(
      user ? { id: user.id, email: user.email, name: user.name } : null,
      requestContext,
      runtimeEnv,
      { browser }
    )
  );
}

/**
 * The tRPC router as the web endpoint calls it for this user's browser: their cookie
 * session (signed in `signedInMinutesAgo` minutes ago, an impersonation if
 * `impersonatedBy`), the request's headers, and the response headers the call sets.
 */
export function browserCallerFor(
  user: TestUser,
  options: {
    readonly cookie?: string;
    readonly signedInMinutesAgo?: number;
    readonly impersonatedBy?: string | null;
    readonly runtimeEnv?: AppEnv;
  } = {}
) {
  const resHeaders = new Headers();
  const caller = callerFor(
    user,
    options.runtimeEnv ?? env,
    testRequestContext(),
    {
      session: {
        createdAt: new Date(
          Date.now() - (options.signedInMinutesAgo ?? 1) * 60 * 1000
        ),
        impersonatedBy: options.impersonatedBy ?? null,
      },
      exchange: {
        headers: new Headers({
          cookie: options.cookie ?? user.cookie,
          origin: APP_URL,
        }),
        resHeaders,
      },
    }
  );
  return { caller, resHeaders };
}

let crossWorkspace:
  | Promise<{ readonly outsider: TestUser; readonly workspaceId: string }>
  | undefined;

/**
 * Asserts that a workspace procedure refuses a signed-in user who is not a member of the
 * named workspace: NOT_FOUND, the same answer as for a workspace that does not exist.
 * Every procedure of a workspace-scoped router is called through this helper in an API
 * test (test/architecture/workspace-scope.test.ts). The owner and the outsider are
 * signed up once per test file.
 */
export async function expectCrossWorkspaceDenied(
  path: string,
  input: Record<string, unknown>
): Promise<void> {
  crossWorkspace ??= (async () => {
    const owner = await signUp("Victoria Owner", "victoria@acme.test");
    const outsider = await signUp("Oscar Outsider", "oscar@elsewhere.test");
    const workspace = await callerFor(owner).workspace.create({
      name: "Acme Robotics",
    });
    return { outsider, workspaceId: workspace.id };
  })();
  const { outsider, workspaceId } = await crossWorkspace;
  await expect(
    invoke(callerFor(outsider), path, { ...input, workspaceId })
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
}
