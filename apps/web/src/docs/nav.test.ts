import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { DOCS } from "./docs.config";
import { buildNav, docTitle, locate, navLabel, navPaths } from "./nav";

const INDEX = `# Docs

## Guides

| Guide | Use when … |
| --- | --- |
| [how-to-a.md](guides/how-to-a.md) | you do A |
| [how-to-b.md](guides/how-to-b.md "B") | you do B, see [a](guides/how-to-a.md) |

## Elsewhere

| Doc | Use when … |
| --- | --- |
| [../README.md](../README.md) | you start |
| [../AGENTS.md](../AGENTS.md) | you are an agent |
| [../.claude/skills/](../.claude/skills/) | skills |

## Empty

No table here.
`;

const titles = new Map([
  ["docs/guides/how-to-a.md", "How to set up A"],
  ["docs/guides/how-to-b.md", "Configuring B"],
]);

describe("docTitle", () => {
  it("reads the first level-one heading", () => {
    expect(docTitle("Intro\n\n# How to set up D1 #\n\n## Next")).toBe(
      "How to set up D1"
    );
    expect(docTitle("## Only a section")).toBeNull();
  });
});

describe("navLabel", () => {
  it("drops a leading How to", () => {
    expect(navLabel("How to set up the D1 database")).toBe(
      "Set up the D1 database"
    );
    expect(navLabel("Account security")).toBe("Account security");
  });
});

describe("buildNav", () => {
  const nav = buildNav(INDEX, titles);

  it("starts with the configured section, then one per heading with a published link", () => {
    expect(nav.map((section) => section.title)).toEqual([
      DOCS.start.title,
      "Guides",
    ]);
    expect(nav[0].items.map((item) => item.href)).toEqual([
      "/docs/",
      "/docs/start/",
      "/docs/guides/how-to-setup-web-app/",
    ]);
  });

  it("takes the first link of each row, labelled with the page title", () => {
    expect(nav[1].items).toEqual([
      {
        path: "docs/guides/how-to-a.md",
        href: "/docs/guides/how-to-a/",
        label: "Set up A",
      },
      {
        path: "docs/guides/how-to-b.md",
        href: "/docs/guides/how-to-b/",
        label: "Configuring B",
      },
    ]);
  });

  it("skips unpublished files, folders and pages already listed", () => {
    expect(navPaths(nav)).not.toContain("AGENTS.md");
    expect(navPaths(nav).filter((path) => path === "README.md")).toHaveLength(
      1
    );
  });
});

describe("locate", () => {
  const nav = buildNav(INDEX, titles);

  it("finds the section and the neighbours in reading order", () => {
    const location = locate(nav, "docs/guides/how-to-a.md");
    expect(location.section?.title).toBe("Guides");
    expect(location.previous?.path).toBe("docs/guides/how-to-setup-web-app.md");
    expect(location.next?.path).toBe("docs/guides/how-to-b.md");
  });

  it("returns nothing for a page outside the navigation", () => {
    expect(locate(nav, "docs/decisions/0000-template.md")).toEqual({
      section: null,
      previous: null,
      next: null,
    });
  });
});

describe("the real docs index", () => {
  const source = readFileSync(
    new URL("../../../../docs/README.md", import.meta.url),
    "utf8"
  );
  const nav = buildNav(source, new Map());

  it("has the sections of docs/README.md", () => {
    expect(nav.map((section) => section.title)).toEqual([
      "Start",
      "Features",
      "Guides",
      "Architecture",
      "Reference",
      "Changelog",
      "Working with agents",
    ]);
  });

  it("lists every guide in the order of the index, after the ones in Start", () => {
    const start = new Set<string>(DOCS.start.items.map((item) => item.path));
    const guides = nav.find((section) => section.title === "Guides");
    const linked = [...source.matchAll(/^\| \[[^\]]+\]\((guides\/[^)]+)\)/gm)]
      .map((match) => `docs/${match[1]}`)
      .filter((path) => !start.has(path));
    expect(guides?.items.map((item) => item.path)).toEqual(linked);
  });

  it("lists a page per feature, under Features", () => {
    const features = nav.find((section) => section.title === "Features");
    expect(features?.items.length).toBeGreaterThanOrEqual(12);
    for (const item of features?.items ?? [])
      expect(item.path).toMatch(/^docs\/features\//);
  });
});
