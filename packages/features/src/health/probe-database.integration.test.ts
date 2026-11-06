import { describe, expect, it } from "vitest";
import { testDb } from "../../test/fixtures";
import { createDatabase } from "../database";
import { probeDatabase } from "./probe-database";

describe("probeDatabase", () => {
  it("answers against the real D1", async () => {
    await expect(probeDatabase({ db: testDb() })).resolves.toBeUndefined();
  });

  it("throws when D1 does not answer", async () => {
    const broken = {
      prepare() {
        throw new Error("D1_ERROR: network connection lost");
      },
    } as unknown as D1Database;
    await expect(
      probeDatabase({ db: createDatabase(broken) })
    ).rejects.toThrow();
  });
});
