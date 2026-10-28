/** Every UI component file is shown in Storybook (imported by at least one story file). */
import { basename } from "node:path";
import { describe, expect, it } from "vitest";

import { filesUnder, read } from "./repo";

const stories = filesUnder("packages/ui/src", /\.stories\.tsx$/).map(read);
const components = filesUnder("packages/ui/src/components", /\.tsx$/).filter(
  (path) =>
    !path.endsWith(".stories.tsx") &&
    // Story data and private helpers of the patterns, not components on their own.
    !/patterns\/(fixtures|internal)\.tsx$/.test(path)
);

describe("stories", () => {
  it.each(components)("%s has stories", (path) => {
    const name = basename(path, ".tsx");
    const imported = stories.some((source) =>
      new RegExp(`from "(\\./|\\.\\./|\\./patterns/)*${name}"`).test(source)
    );
    expect(
      imported,
      `add ${name}.stories.tsx or use it in an existing story`
    ).toBe(true);
  });
});
