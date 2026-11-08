import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  adaptSvg,
  diagramText,
  renderDiagram,
  UNDESCRIBED_DIAGRAMS,
} from "./diagrams";
import { isPublished } from "./links";

const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

function markdownFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === "node_modules" || name.startsWith(".")) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return markdownFiles(path);
    return name.endsWith(".md") ? [relative(ROOT, path)] : [];
  });
}

/** Every ```mermaid block the docs site renders, by file. */
const BLOCKS = markdownFiles(ROOT)
  .filter(isPublished)
  .flatMap((path) =>
    [
      ...readFileSync(join(ROOT, path), "utf8").matchAll(
        /^```mermaid\n([\s\S]*?)^```/gm
      ),
    ].map((match, index) => ({
      path,
      name: `${path} #${index + 1}`,
      source: match[1],
    }))
  );

const SAMPLE = `flowchart LR
  accTitle: Two boxes
  accDescr: A calls B.
  A["A"] --> B["B"]`;

describe("diagramText", () => {
  it("reads the accessibility lines and strips them from the body", () => {
    expect(diagramText(SAMPLE)).toEqual({
      title: "Two boxes",
      description: "A calls B.",
      body: 'flowchart LR\n  A["A"] --> B["B"]',
    });
  });

  it("reads a multi-line accDescr block", () => {
    const text = diagramText(
      "sequenceDiagram\n  accTitle: T\n  accDescr {\n    one\n    two\n  }\n  A->>B: hi"
    );
    expect(text?.description).toBe("one two");
    expect(text?.body).toBe("sequenceDiagram\n  A->>B: hi");
  });

  it("is null without a text alternative, so the block stays code", () => {
    const source = 'flowchart LR\n  accTitle: T\n  A["A"] --> B["B"]';
    expect(diagramText(source)).toBeNull();
    expect(renderDiagram(source, 1)).toBeNull();
  });
});

describe("renderDiagram", () => {
  const html = renderDiagram(SAMPLE, 2) ?? "";

  it("ships no stylesheet, inline style or remote font", () => {
    expect(html).not.toMatch(/<style|\sstyle="|@import|https?:\/\/(?!www\.w3)/);
  });

  it("names and describes the SVG for screen readers", () => {
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-labelledby="diagram-2-title diagram-2-desc"');
    expect(html).toContain('<title id="diagram-2-title">Two boxes</title>');
    expect(html).toContain('<desc id="diagram-2-desc">A calls B.</desc>');
    expect(html).toContain(
      '<section data-diagram-scroll="" tabindex="0" aria-label="Diagram 2: Two boxes">'
    );
  });

  it("prefixes every id and reference", () => {
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    expect(ids.length).toBeGreaterThan(2);
    expect(ids.every((id) => id.startsWith("diagram-2-"))).toBe(true);
    const refs = [...html.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]);
    expect(refs.every((ref) => ids.includes(ref))).toBe(true);
  });

  it("escapes the text alternative", () => {
    const svg = adaptSvg('<svg viewBox="0 0 1 1" style="--bg:x"></svg>', "d", {
      title: "A <b> & C",
      description: 'say "hi"',
      body: "",
    });
    expect(svg).toContain('<title id="d-title">A &lt;b&gt; &amp; C</title>');
    expect(svg).toContain('<desc id="d-desc">say &quot;hi&quot;</desc>');
  });
});

describe("the docs' diagrams", () => {
  it("exist", () => {
    expect(BLOCKS.length).toBeGreaterThan(0);
  });

  // The build renders the same blocks: a failure here would fail `astro build`.
  it.each(BLOCKS.filter((block) => !(block.path in UNDESCRIBED_DIAGRAMS)))(
    "$name renders with a text alternative",
    ({ source }) => {
      const html = renderDiagram(source, 1);
      expect(html, "add accTitle: and accDescr: lines").toContain("<svg");
      expect(html).not.toMatch(/<style|\sstyle="/);
    }
  );

  it("has no stale exemptions", () => {
    const stale = Object.keys(UNDESCRIBED_DIAGRAMS).filter(
      (path) =>
        !BLOCKS.some(
          (block) => block.path === path && diagramText(block.source) === null
        )
    );
    expect(stale, "remove these from UNDESCRIBED_DIAGRAMS").toEqual([]);
  });
});
