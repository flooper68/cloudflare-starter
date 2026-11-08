/**
 * Writes the `.svg` of every Mermaid diagram source under docs/ (`<name>.mmd` →
 * `<name>.svg` beside it) with src/docs/mermaid-svg.ts. Run after changing a source:
 * `bun run docs:diagrams`. mermaid-svg.test.ts fails while an `.svg` is out of date.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";

import { mermaidSources } from "../src/docs/mermaid-sources";
import { mermaidToSvg } from "../src/docs/mermaid-svg";

const root = fileURLToPath(new URL("../../../", import.meta.url));
for (const source of mermaidSources(root)) {
  const target = source.replace(/\.mmd$/, ".svg");
  const name =
    target
      .split("/")
      .pop()
      ?.replace(/\.svg$/, "") ?? "";
  writeFileSync(
    target,
    `${mermaidToSvg(readFileSync(source, "utf8"), name)}\n`
  );
  console.log(`Wrote ${relative(root, target)}`);
}
