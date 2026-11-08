import { describe, expect, it } from "vitest";

import { noteExcerpt, toNoteSummary } from "./note-summary";

describe("note summary", () => {
  it("excerpts the first non-empty line, cut at 140 characters", () => {
    expect(noteExcerpt("\n\n  Freeze the pricing page \nRun the drill")).toBe(
      "Freeze the pricing page"
    );
    expect(noteExcerpt("")).toBe("");
    const long = noteExcerpt("x".repeat(200));
    expect(long).toHaveLength(140);
    expect(long.endsWith("…")).toBe(true);
  });

  it("turns a row into ISO dates, people and its comment count", () => {
    const at = new Date("2026-11-06T12:00:00.000Z");
    expect(
      toNoteSummary(
        {
          id: "note-1",
          title: "Q3 launch",
          body: "Freeze the pricing page",
          createdBy: "ada",
          createdByName: "Ada Lovelace",
          createdAt: at,
          // The editor's account was deleted: attribution is gone.
          updatedBy: null,
          updatedByName: null,
          updatedAt: at,
        },
        2
      )
    ).toEqual({
      id: "note-1",
      title: "Q3 launch",
      excerpt: "Freeze the pricing page",
      createdBy: { userId: "ada", name: "Ada Lovelace" },
      createdAt: "2026-11-06T12:00:00.000Z",
      updatedBy: null,
      updatedAt: "2026-11-06T12:00:00.000Z",
      commentCount: 2,
    });
  });
});
