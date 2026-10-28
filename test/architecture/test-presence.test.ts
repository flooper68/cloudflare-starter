/**
 * Required tests exist (docs/architecture/testing.md): every domain rule has a unit test,
 * every use case a unit or integration test, every tRPC procedure an API test.
 */
import { basename, dirname } from "node:path";
import { describe, expect, it } from "vitest";

import { PROCEDURE_PATHS } from "@/server/mcp/tools";

import { filesUnder, read } from "./repo";

const domainFiles = filesUnder(
  "packages/features/src",
  /^packages\/features\/src\/[^/]+\/domain\/(?!index\.ts$)[^/]+(?<!\.test)\.ts$/
).filter((path) => /export (async )?function /.test(read(path)));

const useCaseFiles = filesUnder(
  "packages/features/src",
  /^packages\/features\/src\/(?!kernel\/|platform\/)[^/]+\/(?!index\.ts$)[^/]+(?<!\.schema|\.test|\.integration\.test)\.ts$/
);

const apiTests = filesUnder("apps/web/test/api", /\.test\.ts$/)
  .map(read)
  .join("\n");

describe("test presence", () => {
  it.each(domainFiles)("%s has a unit test", (path) => {
    const name = basename(path, ".ts");
    const tests = filesUnder(dirname(path), /\.test\.ts$/).map(read);
    const tested = tests.some((source) => source.includes(`from "./${name}"`));
    expect(
      tested,
      `add domain/${name}.test.ts (or import it from a test there)`
    ).toBe(true);
  });

  it.each(useCaseFiles)("%s has a test", (path) => {
    const base = path.replace(/\.ts$/, "");
    const siblings = filesUnder(dirname(path), /\.test\.ts$/);
    const tested = siblings.some(
      (test) =>
        test === `${base}.test.ts` || test === `${base}.integration.test.ts`
    );
    expect(
      tested,
      `add ${basename(base)}.integration.test.ts (real D1) or .test.ts`
    ).toBe(true);
  });

  it.each(PROCEDURE_PATHS)(
    "procedure %s is called in an API test",
    (procedure) => {
      expect(
        apiTests.includes(`.${procedure}(`),
        "call it in apps/web/test/api/"
      ).toBe(true);
    }
  );
});
