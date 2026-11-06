import { describe, expect, it } from "vitest";

import { robotsTxt } from "./robots";

describe("robotsTxt", () => {
  it("disallows everything outside production", () => {
    expect(
      robotsTxt({
        indexable: false,
        site: new URL("https://staging.example.com"),
      })
    ).toBe("User-agent: *\nDisallow: /\n");
  });

  it("keeps crawlers out of the app, API, admin, Storybook and health in production", () => {
    const body = robotsTxt({
      indexable: true,
      site: new URL("https://starter.example.com"),
    });
    for (const path of ["/app", "/api", "/admin", "/_storybook", "/health"])
      expect(body).toContain(`Disallow: ${path}\n`);
    expect(body).not.toMatch(/^Disallow: \/$/m);
    expect(body).toContain(
      "Sitemap: https://starter.example.com/sitemap-index.xml\n"
    );
  });

  it("leaves out the sitemap when the build has no site URL", () => {
    expect(robotsTxt({ indexable: true, site: null })).not.toContain("Sitemap");
  });
});
