import { existsSync, readFileSync } from "node:fs";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { diagramHtml } from "./diagrams";
import { mermaidSources } from "./mermaid-sources";
import { diagramText, mermaidToSvg } from "./mermaid-svg";

const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const SOURCES = mermaidSources(ROOT).map((path) => ({
  path,
  name: relative(ROOT, path),
}));

const SAMPLE = `flowchart LR
  accTitle: Two <boxes>
  accDescr: A calls B.
  A["A"] --> B["B"]`;

describe("diagramText", () => {
  it("reads the accessibility lines and strips them from the body", () => {
    expect(diagramText(SAMPLE)).toEqual({
      title: "Two <boxes>",
      description: "A calls B.",
      body: 'flowchart LR\n  A["A"] --> B["B"]',
    });
  });

  it("reads a multi-line accDescr block", () => {
    const text = diagramText(
      "sequenceDiagram\n  accTitle: T\n  accDescr {\n    one\n    two\n  }\n  A->>B: hi"
    );
    expect(text.description).toBe("one two");
    expect(text.body).toBe("sequenceDiagram\n  A->>B: hi");
  });

  it("refuses a diagram without a text alternative", () => {
    expect(() =>
      diagramText('flowchart LR\n  accTitle: T\n  A["A"] --> B["B"]')
    ).toThrow(/accDescr/);
  });
});

describe("mermaidToSvg", () => {
  const svg = mermaidToSvg(SAMPLE, "sample");

  it("is a docs diagram: titled, described, no script, accepted by the pipeline", () => {
    expect(svg).toMatch(/^<svg [^>]*role="img"/);
    expect(svg).toContain("<title>Two &lt;boxes&gt;</title>");
    expect(svg).toContain("<desc>A calls B.</desc>");
    expect(() => diagramHtml("sample.svg", svg, "Two boxes")).not.toThrow();
  });

  it("loads no font and sets no inline style", () => {
    expect(svg).not.toMatch(/@import|https?:\/\/(?!www\.w3\.org)|\sstyle="/);
  });

  it("colours from the site tokens, with fallbacks for both schemes", () => {
    expect(svg).toContain("--_text:var(--ui-fg, #1f2328)");
    expect(svg).toContain(
      "@media (prefers-color-scheme:dark){.dg-mm{--_text:var(--ui-fg, #f0f6fc)"
    );
  });

  it("prefixes every id and reference with the diagram's name", () => {
    const ids = [...svg.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((id) => id.startsWith("dg-sample-"))).toBe(true);
    const refs = [...svg.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]);
    expect(refs.every((ref) => ids.includes(ref))).toBe(true);
  });
});

describe("the docs' Mermaid diagrams", () => {
  it("exist", () => {
    expect(SOURCES.length).toBeGreaterThan(0);
  });

  it.each(SOURCES)("$name has an up-to-date .svg", ({ path }) => {
    const target = path.replace(/\.mmd$/, ".svg");
    const name =
      target
        .split("/")
        .pop()
        ?.replace(/\.svg$/, "") ?? "";
    expect(existsSync(target), `run bun run docs:diagrams`).toBe(true);
    expect(
      readFileSync(target, "utf8"),
      `${relative(ROOT, target)} is stale: run bun run docs:diagrams`
    ).toBe(`${mermaidToSvg(readFileSync(path, "utf8"), name)}\n`);
  });

  it("names are unique, so marker ids are", () => {
    const names = SOURCES.map(({ path }) => path.split("/").pop());
    expect(new Set(names).size).toBe(names.length);
  });
});
