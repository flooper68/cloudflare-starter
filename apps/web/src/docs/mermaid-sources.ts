/**
 * The Mermaid diagram sources of the docs: every `.mmd` file under docs/, as absolute
 * paths. Shared by scripts/render-diagrams.ts and mermaid-svg.test.ts.
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export function mermaidSources(repoRoot: string): string[] {
  const walk = (dir: string): string[] =>
    readdirSync(dir)
      .sort()
      .flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return walk(path);
        return name.endsWith(".mmd") ? [path] : [];
      });
  return walk(join(repoRoot, "docs"));
}
