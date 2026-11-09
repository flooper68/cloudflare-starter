/**
 * Every server-rendered React island (`client:load`, `client:idle`, `client:visible`)
 * is exported through `hydrationGated` (packages/ui/src/lib/hydration.tsx), so its
 * buttons stay disabled until React has hydrated it and a click before that is never
 * silently lost. `client:only` islands render on the client alone and need no gate.
 */
import { describe, expect, it } from "vitest";

import { filesUnder, read } from "./repo";

const ISLAND = /<([A-Z]\w*)\b[^>]*?\sclient:(?:load|idle|visible)\b/g;

/** `{ name: import source }` of the named imports of an .astro file's frontmatter. */
function namedImports(source: string): Map<string, string> {
  const imports = new Map<string, string>();
  for (const match of source.matchAll(
    /import\s*\{([^}]*)\}\s*from\s*"([^"]+)"/g
  )) {
    for (const name of (match[1] ?? "").split(",")) {
      const local = name
        .trim()
        .split(/\s+as\s+/)
        .pop();
      if (local) imports.set(local, match[2] ?? "");
    }
  }
  return imports;
}

const islands = filesUnder("apps/web/src", /\.astro$/).flatMap((page) => {
  const source = read(page);
  const imports = namedImports(source);
  return [...source.matchAll(ISLAND)].map((match) => {
    const name = match[1] ?? "";
    return { page, name, from: imports.get(name) };
  });
});

describe("server-rendered islands wait for hydration", () => {
  it("finds the islands", () => {
    expect(islands.length).toBeGreaterThan(5);
  });

  it.each(islands)(
    "$name ($page) is exported through hydrationGated",
    ({ name, from }) => {
      expect(from, `${name} is imported from an app component`).toMatch(/^@\//);
      const file = `apps/web/src/${(from ?? "").slice(2)}.tsx`;
      expect(read(file)).toMatch(
        new RegExp(`export const ${name} = hydrationGated\\(`)
      );
    }
  );
});
