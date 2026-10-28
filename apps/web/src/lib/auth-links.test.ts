import { describe, expect, it } from "vitest";

import { authErrorForCode, nextPath } from "./auth-links";

describe("auth links", () => {
  it("follows ?next= only to paths on this site", () => {
    expect(nextPath("?next=/invite/abc")).toBe("/invite/abc");
    expect(nextPath("?next=//evil.example/x")).toBeNull();
    expect(nextPath("?next=https://evil.example")).toBeNull();
    expect(nextPath("?next=/\\evil.example")).toBeNull();
    // Browsers drop tabs and newlines in URLs: "/\t/evil" is "//evil".
    expect(nextPath("?next=/%09/evil.example")).toBeNull();
    expect(nextPath("?next=/%0a/evil.example")).toBeNull();
    expect(nextPath("?next=/%0d/evil.example")).toBeNull();
    expect(nextPath("?next=/invite/abc%3Fx%3D1")).toBe("/invite/abc?x=1");
    expect(nextPath("")).toBeNull();
  });

  it("maps the invite-only code to a message and ignores unknown codes", () => {
    expect(authErrorForCode("SIGN_UP_INVITE_ONLY")).toMatch(/invitation only/);
    expect(authErrorForCode("access_denied")).toBeNull();
    expect(authErrorForCode(null)).toBeNull();
  });
});
