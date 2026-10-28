import { describe, expect, it } from "vitest";

import {
  chunked,
  TRASH_ITEMS_MAX,
  TRASH_PAGE_SIZE_MAX,
  trashItemsInputSchema,
  trashListInputSchema,
} from "./trash-input";

const file = (id: string) => ({ type: "file", id });

describe("trash inputs", () => {
  it("accepts a page request with an optional type, cursor and limit", () => {
    expect(trashListInputSchema.parse({})).toEqual({});
    expect(
      trashListInputSchema.parse({ type: "file", cursor: "1:file:a", limit: 1 })
    ).toEqual({ type: "file", cursor: "1:file:a", limit: 1 });
    expect(
      trashListInputSchema.safeParse({ limit: TRASH_PAGE_SIZE_MAX + 1 }).success
    ).toBe(false);
    expect(trashListInputSchema.safeParse({ limit: 0 }).success).toBe(false);
    // Procedures merge it with the workspace input: other keys are dropped, not refused.
    expect(trashListInputSchema.parse({ workspaceId: "ws-1" })).toEqual({});
  });

  it("takes 1 to 100 distinct items", () => {
    expect(
      trashItemsInputSchema.parse({ items: [file("a"), file("b")] }).items
    ).toHaveLength(2);
    expect(trashItemsInputSchema.safeParse({ items: [] }).success).toBe(false);
    expect(
      trashItemsInputSchema.safeParse({
        items: Array.from({ length: TRASH_ITEMS_MAX + 1 }, (_, i) =>
          file(`f${i}`)
        ),
      }).success
    ).toBe(false);
    expect(
      trashItemsInputSchema.safeParse({ items: [file("a"), file("a")] }).success
    ).toBe(false);
    expect(
      trashItemsInputSchema.safeParse({ items: [{ type: "file", id: "" }] })
        .success
    ).toBe(false);
  });

  it("chunks lists for D1's bound-parameter limit", () => {
    expect(chunked([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunked([], 50)).toEqual([]);
    expect(() => chunked([1], 0)).toThrow(RangeError);
  });
});
