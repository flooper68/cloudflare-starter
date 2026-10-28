import { describe, expect, it } from "vitest";

import { authPathPolicy } from "./auth-path-policy";

describe("authPathPolicy", () => {
  it.each([
    ["/sign-in/email", "auth.sign-in"],
    ["/sign-in/social", "auth.sign-in"],
    ["/sign-up/email", "auth.sign-up"],
    ["/request-password-reset", "auth.password-reset"],
    ["/oauth2/token", "auth.oauth-token"],
    ["/send-verification-email", "auth.verification-email"],
  ])("maps %s to %s", (path, id) => {
    expect(authPathPolicy(path)).toBe(id);
  });

  it.each(["/get-session", "/sign-in", "/request-password-reset/x"])(
    "has no Better Auth policy for %s",
    (path) => {
      expect(authPathPolicy(path)).toBeNull();
    }
  );
});
