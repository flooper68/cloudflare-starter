// Sign-in and sign-up do not depend on the audit log: when an audit event cannot be
// written, the failure is reported with the request's trace id and the user is signed in.
// Its own file: it drops audit_events, and each test file has its own database.
import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getAuth } from "@/server/auth";
import { REQUEST_ID_HEADER, withRequestContext } from "@/server/http";

import { APP_URL } from "./helpers";

interface Report {
  readonly body: string;
  readonly trace_id: string;
  readonly attributes: Record<string, unknown>;
}

function authPost(path: string, body: unknown): Promise<Response> {
  const request = new Request(`${APP_URL}/api/auth${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: APP_URL },
    body: JSON.stringify(body),
  });
  return withRequestContext(request, env, () => getAuth(env).handler(request));
}

describe("audit log failures in Better Auth hooks", () => {
  afterEach(() => vi.restoreAllMocks());

  it("are reported and do not fail sign-up or sign-in", async () => {
    await env.DB.prepare("DROP TABLE audit_events").run();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const reports = () =>
      spy.mock.calls
        .map(([record]) => record as Report)
        .filter((record) => record?.body === "error.captured");

    const signUp = await authPost("/sign-up/email", {
      name: "Katherine Johnson",
      email: "katherine@example.test",
      password: "test-password-1234",
    });
    expect(signUp.status).toBe(200);

    const signIn = await authPost("/sign-in/email", {
      email: "katherine@example.test",
      password: "test-password-1234",
    });
    expect(signIn.status).toBe(200);

    // Workspace provisioning records workspace.created; it fails open the same way.
    expect(
      reports()
        .filter((report) => report.attributes["app.auth.hook"])
        .map((report) => [report.attributes["app.auth.hook"], report.trace_id])
    ).toEqual([["user.create.after", signUp.headers.get(REQUEST_ID_HEADER)]]);
    expect(
      reports()
        .filter((report) => report.attributes["app.audit.action"])
        .map((report) => [
          report.attributes["app.audit.action"],
          report.trace_id,
        ])
    ).toEqual([
      ["auth.sign_up", signUp.headers.get(REQUEST_ID_HEADER)],
      ["auth.sign_in", signUp.headers.get(REQUEST_ID_HEADER)],
      ["auth.sign_in", signIn.headers.get(REQUEST_ID_HEADER)],
    ]);
  });
});
