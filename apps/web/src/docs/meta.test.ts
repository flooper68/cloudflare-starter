import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { docDescription } from "./meta";

describe("docDescription", () => {
  it("is the first paragraph after the title, as plain text", () => {
    expect(
      docDescription(
        "# How to set up D1\n\nThe app stores its data in [D1](https://x.example) via `DB`,\nwith **Drizzle**.\n\n## Next\n"
      )
    ).toBe("The app stores its data in D1 via DB, with Drizzle.");
  });

  it("cuts long paragraphs at a word boundary", () => {
    const words = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");
    const description = docDescription(`# T\n\n${words}\n`) ?? "";
    expect(description.length).toBeLessThanOrEqual(160);
    expect(description.endsWith("…")).toBe(true);
    expect(description).not.toMatch(/\s…$/);
  });

  it("is null when the doc does not start with a paragraph", () => {
    expect(docDescription("# T\n\n| a | b |\n| - | - |\n")).toBeNull();
    expect(docDescription("# T\n\n- a list\n")).toBeNull();
    expect(docDescription("# T\n")).toBeNull();
  });

  it("describes every guide of the real docs", () => {
    const source = readFileSync(
      new URL("../../../../docs/guides/how-to-setup-d1.md", import.meta.url),
      "utf8"
    );
    expect(docDescription(source)).toMatch(/^The web app stores its data/);
  });
});
