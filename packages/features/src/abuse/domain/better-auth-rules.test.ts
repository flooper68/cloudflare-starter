import { describe, expect, it } from "vitest";

import { betterAuthRules } from "./better-auth-rules";
import { RATE_LIMIT_POLICIES } from "./policies";

describe("betterAuthRules", () => {
  it("turns better-auth policies into customRules by path", () => {
    expect(betterAuthRules(RATE_LIMIT_POLICIES)).toEqual({
      "/sign-in/*": { window: 60, max: 10 },
      "/sign-up/*": { window: 60, max: 5 },
      "/request-password-reset": { window: 60, max: 3 },
      "/oauth2/register": { window: 3600, max: 5 },
      "/oauth2/token": { window: 60, max: 10 },
      "/oauth2/authorize": { window: 60, max: 10 },
    });
  });

  it("ignores edge policies", () => {
    expect(
      betterAuthRules({
        "x.ip": {
          limit: 1,
          periodSeconds: 10,
          scope: "ip",
          enforcer: "edge",
          binding: "RL_X",
          description: "test",
        },
      })
    ).toEqual({});
  });
});
