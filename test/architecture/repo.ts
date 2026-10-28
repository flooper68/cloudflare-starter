import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/** Repository root, for architecture tests that read files. */
export const ROOT = fileURLToPath(new URL("../..", import.meta.url));

/** Files under `dir` (relative to ROOT) whose path matches `include`, skipping node_modules. */
export function filesUnder(dir: string, include: RegExp): string[] {
  const walk = (path: string): string[] =>
    readdirSync(path).flatMap((name) => {
      if (name === "node_modules" || name.startsWith(".")) return [];
      const full = join(path, name);
      if (statSync(full).isDirectory()) return walk(full);
      const rel = relative(ROOT, full);
      return include.test(rel) ? [rel] : [];
    });
  return walk(join(ROOT, dir));
}

export function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}
