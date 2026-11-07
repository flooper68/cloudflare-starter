import { describe, expect, it } from "vitest";

import { prerenderedWebAnalytics } from "./web-analytics";

describe("prerenderedWebAnalytics", () => {
  it("is the token with WEB_ANALYTICS=cloudflare and a token", () => {
    expect(
      prerenderedWebAnalytics({
        WEB_ANALYTICS: "cloudflare",
        WEB_ANALYTICS_TOKEN: "0123abcd",
      })
    ).toEqual({ token: "0123abcd" });
  });

  it("is null otherwise, without needing any secret", () => {
    expect(prerenderedWebAnalytics({ WEB_ANALYTICS: "none" })).toBeNull();
    expect(
      prerenderedWebAnalytics({
        WEB_ANALYTICS: "cloudflare",
        WEB_ANALYTICS_TOKEN: "",
      })
    ).toBeNull();
    expect(prerenderedWebAnalytics({})).toBeNull();
  });
});
