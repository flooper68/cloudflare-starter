import { describe, expect, it } from "vitest";

import { DOCS } from "./docs.config";
import {
  editUrl,
  isPublished,
  parseRepoLink,
  resolveRepoPath,
  rewriteHref,
  routeFor,
} from "./links";

const blob = (path: string) => `${DOCS.repoUrl}/blob/${DOCS.branch}/${path}`;

describe("isPublished", () => {
  it.each([
    "docs/README.md",
    "docs/guides/how-to-setup-d1.md",
    "docs/decisions/0000-template.md",
    "docs/start/README.md",
    "apps/web/README.md",
    "packages/ui/README.md",
    "packages/ui/CONVENTIONS.md",
  ])("publishes %s", (path) => {
    expect(isPublished(path)).toBe(true);
  });

  it.each([
    // The repository's front page on GitHub, with HTML images the site would not serve.
    "README.md",
    "AGENTS.md",
    ".claude/skills/setup-d1/SKILL.md",
    ".github/pull_request_template.md",
    "apps/web/src/README.md",
    "packages/features/CONVENTIONS.md",
    "docs/guides/how-to-setup-d1.mdx",
    "apps/web/wrangler.jsonc",
  ])("does not publish %s", (path) => {
    expect(isPublished(path)).toBe(false);
  });
});

describe("routeFor", () => {
  it.each([
    ["docs/README.md", "/docs/"],
    ["docs/guides/how-to-setup-d1.md", "/docs/guides/how-to-setup-d1/"],
    ["docs/decisions/README.md", "/docs/decisions/"],
    ["docs/start/README.md", "/docs/start/"],
    ["apps/web/README.md", "/docs/apps/web/"],
    ["packages/ui/CONVENTIONS.md", "/docs/packages/ui/conventions/"],
  ])("%s is served at %s", (path, route) => {
    expect(routeFor(path)).toBe(route);
  });
});

describe("resolveRepoPath", () => {
  it("resolves against the folder of the file", () => {
    expect(resolveRepoPath("docs/guides/a.md", "../architecture/b.md")).toBe(
      "docs/architecture/b.md"
    );
    expect(resolveRepoPath("docs/README.md", "./guides/./a.md")).toBe(
      "docs/guides/a.md"
    );
    expect(resolveRepoPath("README.md", "docs/README.md")).toBe(
      "docs/README.md"
    );
  });

  it("refuses paths that leave the repository", () => {
    expect(resolveRepoPath("docs/README.md", "../../etc/passwd")).toBeNull();
  });
});

describe("parseRepoLink", () => {
  it.each([
    "https://example.com/a.md",
    "mailto:someone@example.com",
    "/app/dashboard",
    "#section",
    "",
  ])("ignores %j", (href) => {
    expect(parseRepoLink("docs/README.md", href)).toBeNull();
  });

  it("splits the path and the fragment", () => {
    expect(
      parseRepoLink("docs/guides/a.md", "../architecture/overview.md#parts")
    ).toEqual({
      path: "docs/architecture/overview.md",
      anchor: "parts",
      folder: false,
    });
  });

  it("decodes escaped characters and marks folders", () => {
    expect(parseRepoLink("docs/README.md", "../.claude/skills/")).toEqual({
      path: ".claude/skills",
      anchor: null,
      folder: true,
    });
    expect(parseRepoLink("docs/README.md", "guides/a%20b.md")?.path).toBe(
      "docs/guides/a b.md"
    );
  });
});

describe("rewriteHref", () => {
  it("points a published file at its page and keeps the fragment", () => {
    expect(
      rewriteHref(
        "docs/guides/how-to-setup-auth.md",
        "../architecture/overview.md#account-security"
      )
    ).toBe("/docs/architecture/overview/#account-security");
    expect(rewriteHref("docs/README.md", "start/README.md")).toBe(
      "/docs/start/"
    );
    expect(rewriteHref("docs/README.md", "../packages/ui/CONVENTIONS.md")).toBe(
      "/docs/packages/ui/conventions/"
    );
  });

  it("points other repository files and folders at GitHub", () => {
    expect(
      rewriteHref(
        "docs/guides/how-to-setup-d1.md",
        "../../apps/web/wrangler.jsonc"
      )
    ).toBe(blob("apps/web/wrangler.jsonc"));
    expect(rewriteHref("docs/README.md", "../AGENTS.md")).toBe(
      blob("AGENTS.md")
    );
    expect(rewriteHref("docs/README.md", "../.claude/skills/")).toBe(
      `${DOCS.repoUrl}/tree/${DOCS.branch}/.claude/skills`
    );
    expect(
      rewriteHref(
        "docs/processes/development.md",
        "../../.github/pull_request_template.md#checks"
      )
    ).toBe(`${blob(".github/pull_request_template.md")}#checks`);
  });

  it("leaves absolute, site and fragment links alone", () => {
    for (const href of [
      "https://developers.cloudflare.com/d1/",
      "/_storybook/",
      "#local-development",
      "../../../outside.md",
    ])
      expect(rewriteHref("docs/guides/how-to-setup-d1.md", href)).toBe(href);
  });
});

describe("editUrl", () => {
  it("opens the file in GitHub's editor", () => {
    expect(editUrl("docs/README.md")).toBe(
      `${DOCS.repoUrl}/edit/${DOCS.branch}/docs/README.md`
    );
  });
});
