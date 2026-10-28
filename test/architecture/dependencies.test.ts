/** Every dependency is pinned to an exact version (bunfig.toml sets exact = true). */
import { describe, expect, it } from "vitest";

import { filesUnder, read } from "./repo";

const manifests = filesUnder(".", /(^|\/)package\.json$/).filter(
  (path) => !path.includes("_storybook")
);

describe("dependencies", () => {
  it.each(manifests)("%s pins exact versions", (path) => {
    const pkg = JSON.parse(read(path)) as Record<
      string,
      Record<string, string> | undefined
    >;
    const ranges = [
      "dependencies",
      "devDependencies",
      "peerDependencies",
      "optionalDependencies",
    ]
      .flatMap((field) => Object.entries(pkg[field] ?? {}))
      .filter(([, version]) => /^[\^~><*]|^latest$|\sx\b/.test(version))
      .map(([name, version]) => `${name}@${version}`);
    expect(
      ranges,
      "pin with bun add (exact) or edit to an exact version"
    ).toEqual([]);
  });
});
