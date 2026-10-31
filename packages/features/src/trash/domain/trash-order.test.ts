import { describe, expect, it } from "vitest";

import { InvalidTrashInputError } from "./errors";
import {
  compareTrashPositions,
  decodeTrashCursor,
  encodeTrashCursor,
  type TrashPosition,
  trashPageStart,
} from "./trash-order";

const at = (deletedAtMs: number, type: string, id: string): TrashPosition => ({
  deletedAtMs,
  type,
  id,
});

describe("trash order", () => {
  it("lists the most recently trashed first, then by type and id", () => {
    const items = [
      at(100, "file", "b"),
      at(200, "file", "a"),
      at(100, "note", "a"),
      at(100, "file", "a"),
    ];
    expect([...items].sort(compareTrashPositions)).toEqual([
      at(200, "file", "a"),
      at(100, "file", "a"),
      at(100, "file", "b"),
      at(100, "note", "a"),
    ]);
    expect(compareTrashPositions(at(1, "file", "a"), at(1, "file", "a"))).toBe(
      0
    );
  });

  it("round-trips a cursor, ids with colons included", () => {
    const position = at(1_761_652_800_000, "file", "urn:x:1");
    expect(decodeTrashCursor(encodeTrashCursor(position))).toEqual(position);
  });

  it("refuses a cursor it did not write", () => {
    for (const value of ["", "abc", "12", "12:file", "x:file:id", ":file:id"]) {
      expect(() => decodeTrashCursor(value), value).toThrow(
        InvalidTrashInputError
      );
    }
  });

  it("starts a type's next page after the cursor in the shared order", () => {
    const cursor = at(100, "file", "m");
    expect(trashPageStart("file", cursor)).toEqual({
      beforeMs: 100,
      sameMs: { afterId: "m" },
    });
    // A later type: all of its items in the cursor's millisecond follow it.
    expect(trashPageStart("note", cursor)).toEqual({
      beforeMs: 100,
      sameMs: { afterId: null },
    });
    // An earlier type: its items in that millisecond came before the cursor.
    expect(trashPageStart("audio", cursor)).toEqual({
      beforeMs: 100,
      sameMs: null,
    });
  });
});
