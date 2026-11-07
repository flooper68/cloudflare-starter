/**
 * The pages' Content-Security-Policy allows no 'unsafe-inline' script: an inline script
 * runs only when Astro hashed it at build time. These rules keep new markup inside that
 * contract (docs/guides/how-to-configure-security-headers.md#inline-scripts-and-styles).
 */
import { describe, expect, it } from "vitest";

import { filesUnder, read } from "./repo";

const astroFiles = filesUnder("apps/web/src", /\.astro$/);
const componentFiles = [
  ...filesUnder("apps/web/src", /\.tsx$/),
  ...filesUnder("packages/ui/src", /\.tsx$/),
].filter((file) => !file.endsWith(".stories.tsx"));

/** Every `<script …>` opening tag of a file. */
function scriptTags(source: string): string[] {
  return source.match(/<script\b[^>]*>/g) ?? [];
}

describe("inline scripts and styles", () => {
  it("finds the pages", () => {
    expect(astroFiles).toContain("apps/web/src/layouts/Layout.astro");
  });

  it.each(astroFiles)(
    "%s: an is:inline script is data or an external file, never inline code",
    (file) => {
      for (const tag of scriptTags(read(file))) {
        if (!tag.includes("is:inline")) continue;
        // Astro does not hash is:inline code; data blocks and external files need no hash.
        const data = /type="application\/(ld\+)?json"/.test(tag);
        const external = /\bsrc=/.test(tag);
        expect(data || external, `${file}: ${tag}`).toBe(true);
      }
    }
  );

  it.each(astroFiles)(
    "%s: set:html only fills a data block, and no inline event handlers",
    (file) => {
      const source = read(file);
      for (const match of source.matchAll(/<(\w+)\b[^>]*\bset:html=/g)) {
        expect(match[0], file).toMatch(
          /^<script\b[^>]*type="application\/json"/
        );
      }
      expect(source, file).not.toMatch(/<[a-z][^>]*\son[a-z]+=["{]/);
    }
  );

  it.each(componentFiles)(
    "%s: no dangerouslySetInnerHTML (it could carry script or style the policy blocks)",
    (file) => {
      expect(read(file)).not.toContain("dangerouslySetInnerHTML");
    }
  );
});

describe("E2E journeys", () => {
  const specs = [
    ...filesUnder("apps/web/test/e2e", /\.(spec|setup)\.ts$/),
    ...filesUnder("apps/web/test/e2e-build", /\.spec\.ts$/),
  ];

  it.each(specs)(
    "%s: runs under the CSP guard (imports test from fixtures.ts)",
    (file) => {
      const source = read(file);
      expect(source).not.toMatch(/from "@playwright\/test"/);
      expect(source).toMatch(/from "\.\.?\/(e2e\/)?fixtures"/);
    }
  );
});
