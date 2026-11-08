/**
 * The docs' images stay whole (docs/guides/how-to-publish-docs-and-landing.md#screenshots):
 * - every screenshot a doc names (`shot="…"`, `::shot{id="…"}`, `poster="…"`) is in
 *   docs/images/screens/manifest.json with its dark and light images, and every image
 *   the manifest lists is in the repository, under the 150 KB budget;
 * - no image in docs/images/screens is left out of the manifest;
 * - every relative Markdown image in a published doc exists.
 * The docs build fails on the same problems; this catches them in `bun run test`.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SCREENS_DIR,
  SCREENS_MANIFEST,
  type ScreensManifest,
} from "@/docs/kit/shots";
import { isPublished } from "@/docs/links";

import { filesUnder, ROOT, read } from "./repo";

const PUBLISHED = filesUnder(".", /\.md$/).filter(isPublished);
const manifest = JSON.parse(read(SCREENS_MANIFEST)) as ScreensManifest;
const MAX_BYTES = 150 * 1024;

/** The Markdown without fenced code blocks and inline code spans. */
function prose(source: string): string {
  return source
    .replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[ \t]*$/gm, "")
    .replace(/`+[^`\n]*`+/g, "");
}

/** Screenshot ids a doc names in its directives. */
function shotIds(source: string): string[] {
  const text = prose(source);
  return [
    ...text.matchAll(/^:{3}screenshot\{[^}]*\bshot="([^"]+)"/gm),
    ...text.matchAll(/^\s*::shot\{[^}]*\bid="([^"]+)"/gm),
    ...text.matchAll(/^::video\{[^}]*\bposter="([^"]+)"/gm),
  ].map((match) => match[1] as string);
}

const references = PUBLISHED.flatMap((path) =>
  shotIds(read(path)).map((id) => [path, id] as const)
);

describe("docs screenshots", () => {
  it("are used by the docs (the checks below are not vacuous)", () => {
    expect(references.length).toBeGreaterThan(10);
  });

  it.each(references)("%s: shot %s is captured in both themes", (_, id) => {
    const entry = manifest.shots[id];
    expect(
      entry,
      `add "${id}" to apps/web/test/screens/shots.ts and run bun run docs:screenshots`
    ).toBeDefined();
    expect(entry?.variants.dark).toBeDefined();
    expect(entry?.variants.light).toBeDefined();
  });

  const images = Object.entries(manifest.shots).flatMap(([id, entry]) =>
    Object.values(entry.variants).map((image) => [id, image] as const)
  );

  it.each(images)("%s: %o is in the repository, under 150 KB", (_, image) => {
    const path = join(ROOT, SCREENS_DIR, image.file);
    expect(existsSync(path), `${image.file} is missing`).toBe(true);
    expect(statSync(path).size).toBeLessThanOrEqual(MAX_BYTES);
  });

  it("lists every image in the screenshots folder", () => {
    const listed = new Set(images.map(([, image]) => image.file));
    const files = readdirSync(join(ROOT, SCREENS_DIR)).filter((name) =>
      name.endsWith(".webp")
    );
    expect(files.filter((name) => !listed.has(name))).toEqual([]);
  });
});

describe("docs images", () => {
  const links = PUBLISHED.flatMap((path) =>
    [...prose(read(path)).matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)]
      .map((match) => match[1] as string)
      .filter(
        (url) => !/^[a-z][a-z0-9+.-]*:/i.test(url) && !url.startsWith("/")
      )
      .map((url) => [path, url] as const)
  );

  it.each(links)("%s: %s exists", (path, url) => {
    const target = join(
      ROOT,
      dirname(path),
      decodeURIComponent(url.split("#")[0] as string)
    );
    expect(existsSync(target)).toBe(true);
  });
});
