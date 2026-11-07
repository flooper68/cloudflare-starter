import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import {
  gzipSize,
  inlineScripts,
  measurePagefind,
  measurePages,
  pageScripts,
  staticImports,
} from "./bundle-budget";

describe("pageScripts", () => {
  it("lists same-origin scripts and module preloads", () => {
    expect(
      pageScripts(
        '<script src="/site-theme.js"></script><script type="module" src="/_astro/a.js"></script>' +
          '<link rel="modulepreload" href="/_astro/b.js"><script src="https://static.cloudflareinsights.com/beacon.min.js"></script>'
      )
    ).toEqual(["/site-theme.js", "/_astro/a.js", "/_astro/b.js"]);
  });
});

describe("pageScripts with islands", () => {
  it("counts the component and renderer of a hydrated island", () => {
    expect(
      pageScripts(
        '<astro-island uid="1" component-url="/_astro/HomePage.abc.js" renderer-url="/_astro/client.def.js" client="load"></astro-island>'
      )
    ).toEqual(["/_astro/HomePage.abc.js", "/_astro/client.def.js"]);
  });
});

describe("inlineScripts", () => {
  it("finds inline code but not external scripts or JSON data", () => {
    expect(
      inlineScripts(
        '<script src="/a.js"></script><script type="application/json">{"a":1}</script><script>alert(1)</script>'
      )
    ).toEqual(["<script>alert(1)</script>"]);
  });
});

describe("staticImports", () => {
  it("finds static imports and re-exports, not dynamic imports", () => {
    expect(
      staticImports(
        'import{a as b}from"./chunk.js";import"./side.js";export{c}from"./re.js";const p=import("/pagefind/pagefind.js");'
      )
    ).toEqual(["./chunk.js", "./side.js", "./re.js"]);
  });
});

describe("measurePages", () => {
  const client = mkdtempSync(join(tmpdir(), "budget-"));
  afterAll(() => rmSync(client, { recursive: true, force: true }));
  mkdirSync(join(client, "_astro"));
  mkdirSync(join(client, "docs"));
  mkdirSync(join(client, "pagefind"));
  const entry = 'import"./shared.js";console.log("entry")';
  const shared = "export const x = 1;";
  writeFileSync(join(client, "_astro", "entry.js"), entry);
  writeFileSync(join(client, "_astro", "shared.js"), shared);
  writeFileSync(
    join(client, "docs", "index.html"),
    '<script type="module" src="/_astro/entry.js"></script>'
  );
  writeFileSync(join(client, "404.html"), "<p>no script</p>");
  writeFileSync(join(client, "pagefind", "pagefind.js"), "x".repeat(100));

  it("adds the static imports of each page's scripts, once each", () => {
    const pages = measurePages(client);
    const docs = pages.find((page) => page.page === "/docs/index.html");
    expect([...(docs?.files ?? [])].sort()).toEqual([
      "/_astro/entry.js",
      "/_astro/shared.js",
    ]);
    expect(docs?.bytes).toBe(gzipSize(entry) + gzipSize(shared));
    expect(pages.find((page) => page.page === "/404.html")?.bytes).toBe(0);
  });

  it("fails when a page loads a script the build lacks", () => {
    writeFileSync(
      join(client, "docs", "broken.html"),
      '<script type="module" src="/_astro/missing.js"></script>'
    );
    expect(() => measurePages(client)).toThrow(/missing\.js, not in the build/);
    rmSync(join(client, "docs", "broken.html"));
  });

  it("measures each Pagefind file", () => {
    expect(measurePagefind(client)).toEqual([
      { file: "/pagefind/pagefind.js", bytes: gzipSize("x".repeat(100)) },
    ]);
  });
});
