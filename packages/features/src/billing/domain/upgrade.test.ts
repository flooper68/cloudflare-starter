import { describe, expect, it } from "vitest";

import { upgradeOptions } from "./upgrade";

describe("upgradeOptions", () => {
  it("offers customer plans that cover the need and add-ons that raise it", () => {
    expect(upgradeOptions("free", { metric: "seats", needed: 4 })).toEqual({
      planIds: ["pro"],
      addonIds: ["extra_seats"],
    });
    expect(
      upgradeOptions("free", { feature: "files.presigned_upload" })
    ).toEqual({ planIds: ["pro"], addonIds: ["direct_uploads"] });
  });

  it("never suggests a smaller plan, even when an override lowered the limit", () => {
    // On pro with a storage override of 5 bytes, free (100 MB) would cover 10 bytes, but
    // it is not an upgrade.
    expect(
      upgradeOptions("pro", { metric: "storage_bytes", needed: 10 })
    ).toEqual({
      planIds: [],
      addonIds: ["extra_storage"],
    });
  });

  it("leaves out the current plan, internal plans and plans that fall short", () => {
    expect(upgradeOptions("pro", { metric: "seats", needed: 26 })).toEqual({
      planIds: [],
      addonIds: ["extra_seats"],
    });
    expect(
      upgradeOptions("free", { metric: "files.uploads_per_month", needed: 101 })
    ).toEqual({ planIds: ["pro"], addonIds: [] });
  });
});
