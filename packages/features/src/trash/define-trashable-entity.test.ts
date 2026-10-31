import { describe, expect, it } from "vitest";

import { schema } from "../database";
import {
  defineTrashableEntity,
  type TrashableEntity,
} from "./define-trashable-entity";
import { InvalidTrashInputError } from "./domain";

const entity: TrashableEntity = {
  type: "file",
  table: schema.files,
  retentionDays: 30,
  permission: "files.write",
  summarize: (row) => ({ label: row.id, sizeBytes: null }),
  checkRestore: async () => {},
  purge: async (_deps, ids) => ({ purgedIds: ids }),
};

describe("defineTrashableEntity", () => {
  it("returns the entity, frozen", () => {
    const defined = defineTrashableEntity(entity);
    expect(defined).toEqual(entity);
    expect(Object.isFrozen(defined)).toBe(true);
  });

  it("refuses a retention that is not a whole number of days, at least 1", () => {
    for (const retentionDays of [0, -3, 2.5]) {
      expect(() => defineTrashableEntity({ ...entity, retentionDays })).toThrow(
        InvalidTrashInputError
      );
    }
  });
});
