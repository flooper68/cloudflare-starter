import { RATE_LIMIT_POLICIES } from "@cloudflare-starter/features";
import type { APIContext } from "astro";
import { describe, expect, it } from "vitest";
import { POST as avatarRoute } from "@/pages/api/account/avatar/index";
import { ALL as authRoute } from "@/pages/api/auth/[...all]";
import { POST as logoRoute } from "@/pages/api/workspaces/[workspaceId]/logo/index";
import {
  APP_URL,
  callerFor,
  signUp,
  type TestUser,
  testRequestContext,
} from "./helpers";

function context(
  request: Request,
  user: TestUser,
  params: Record<string, string> = {}
) {
  return {
    request,
    url: new URL(request.url),
    params,
    locals: {
      user,
      requestContext: {
        ...testRequestContext(),
        ip: request.headers.get("cf-connecting-ip"),
      },
    },
  } as unknown as APIContext;
}
async function quota(limit: number, send: () => Promise<Response>) {
  let first: Response | undefined;
  for (let call = 1; call <= limit * 2 + 1; call++) {
    const response = await send();
    first ??= response;
    if (response.status === 429) return { first, response, call };
  }
  throw new Error("never rate limited");
}
async function expectQuota(
  response: Response,
  policy: keyof typeof RATE_LIMIT_POLICIES,
  path: string
) {
  const { limit, periodSeconds } = RATE_LIMIT_POLICIES[policy];
  const wait = Number(response.headers.get("retry-after"));
  expect(response.status).toBe(429);
  expect(wait).toBeGreaterThan(0);
  expect(wait).toBeLessThanOrEqual(periodSeconds);
  expect(response.headers.get("ratelimit-policy")).toBe(
    `"${policy}";q=${limit};w=${periodSeconds}`
  );
  expect(response.headers.get("ratelimit")).toBe(`"${policy}";r=0;t=${wait}`);
  expect(response.headers.get("content-type")).toBe("application/problem+json");
  expect(await response.json()).toMatchObject({
    type: "https://iana.org/assignments/http-problem-types#quota-exceeded",
    title: "Too Many Requests",
    status: 429,
    instance: path,
    code: "RATE_LIMITED",
    "violated-policies": [policy],
    retryAfterSeconds: wait,
    reference: expect.stringMatching(/^[0-9a-f]{32}$/),
  });
}

describe("profile mutation quotas at the HTTP edge", () => {
  it.each([
    ["auth.change-email", "/change-email", { newEmail: "not-an-email" }],
    ["auth.delete-user", "/delete-user", { password: "wrong-password-1234" }],
  ] as const)(
    "enforces %s with standard headers and Problem Details",
    async (policy, path, body) => {
      const user = await signUp(`Quota ${policy}`, `${policy}@example.test`);
      const { limit } = RATE_LIMIT_POLICIES[policy];
      const fullPath = `/api/auth${path}`;
      const { first, response, call } = await quota(limit, async () =>
        authRoute(
          context(
            new Request(`${APP_URL}${fullPath}`, {
              method: "POST",
              headers: {
                origin: APP_URL,
                cookie: user.cookie,
                "content-type": "application/json",
                "cf-connecting-ip":
                  policy === "auth.change-email" ? "192.0.2.80" : "192.0.2.81",
              },
              body: JSON.stringify(body),
            }),
            user
          )
        )
      );
      expect(first.status).toBe(policy === "auth.delete-user" ? 404 : 400);
      expect(call).toBe(limit + 1);
      expect(first.headers.get("ratelimit-policy")).toContain(
        `"${policy}";q=${limit}`
      );
      await expectQuota(response, policy, fullPath);
    }
  );
  it.each(["avatar", "logo"] as const)(
    "enforces %s upload.user without storing invalid input",
    async (kind) => {
      const user = await signUp(`Quota ${kind}`, `quota-${kind}@example.test`);
      const workspaceId = (await callerFor(user).workspace.list())
        .activeWorkspaceId as string;
      const path =
        kind === "avatar"
          ? "/api/account/avatar"
          : `/api/workspaces/${workspaceId}/logo`;
      const handler = kind === "avatar" ? avatarRoute : logoRoute;
      const { limit } = RATE_LIMIT_POLICIES["upload.user"];
      const { first, response, call } = await quota(limit, async () =>
        handler(
          context(
            new Request(`${APP_URL}${path}`, {
              method: "POST",
              headers: {
                origin: APP_URL,
                "content-type": "image/png",
                "cf-connecting-ip":
                  kind === "avatar" ? "192.0.2.82" : "192.0.2.83",
              },
              body: "not an image",
            }),
            user,
            { workspaceId }
          )
        )
      );
      expect(first.status).toBe(400);
      expect(call).toBeGreaterThan(limit);
      await expectQuota(response, "upload.user", path);
    }
  );
});
