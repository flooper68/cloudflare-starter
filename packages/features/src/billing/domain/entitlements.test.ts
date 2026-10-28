import { describe, expect, it } from "vitest";

import { DomainError } from "../../kernel";
import { findPlan, type Plan, UNLIMITED_PLAN } from "./catalog";
import {
  checkLimit,
  entitlements,
  hasFeature,
  requireIncluded,
} from "./entitlements";
import { FeatureNotIncludedError, LimitReachedError } from "./errors";

const free = findPlan("free") as Plan;
const pro = findPlan("pro") as Plan;

describe("entitlements", () => {
  it("is the plan's features and limits without add-ons or overrides", () => {
    expect(entitlements(free, [], [])).toEqual({
      planId: "free",
      features: [],
      limits: free.limits,
    });
  });

  it("adds add-on features and raises limits per unit of quantity", () => {
    const ent = entitlements(
      free,
      [
        { addonId: "extra_seats", quantity: 2 },
        { addonId: "direct_uploads", quantity: 1 },
        { addonId: "retired_addon", quantity: 3 },
      ],
      []
    );
    expect(ent.limits.seats).toBe(3 + 2 * 5);
    expect(hasFeature(ent, "files.presigned_upload")).toBe(true);
  });

  it("keeps an unlimited limit unlimited when an add-on raises it", () => {
    const ent = entitlements(
      UNLIMITED_PLAN,
      [{ addonId: "extra_seats", quantity: 1 }],
      []
    );
    expect(ent.limits.seats).toBeNull();
  });

  it("lets overrides win: grant, revoke, set a limit, make it unlimited", () => {
    const granted = entitlements(
      free,
      [],
      [{ key: "files.presigned_upload", kind: "feature", enabled: true }]
    );
    expect(hasFeature(granted, "files.presigned_upload")).toBe(true);

    const revoked = entitlements(
      pro,
      [{ addonId: "direct_uploads", quantity: 1 }],
      [{ key: "files.presigned_upload", kind: "feature", enabled: false }]
    );
    expect(hasFeature(revoked, "files.presigned_upload")).toBe(false);

    const limited = entitlements(
      pro,
      [{ addonId: "extra_seats", quantity: 4 }],
      [
        { key: "seats", kind: "limit", limit: 2 },
        { key: "storage_bytes", kind: "limit", limit: null },
        { key: "unknown_metric", kind: "limit", limit: 1 },
      ]
    );
    expect(limited.limits.seats).toBe(2);
    expect(limited.limits.storage_bytes).toBeNull();
  });
});

describe("checkLimit", () => {
  const ent = entitlements(
    free,
    [],
    [{ key: "seats", kind: "limit", limit: 10 }]
  );

  it("allows up to the limit: one below, exactly at it", () => {
    expect(() => checkLimit(ent, "seats", 8, 1)).not.toThrow();
    expect(() => checkLimit(ent, "seats", 9, 1)).not.toThrow();
    expect(() => checkLimit(ent, "seats", 10, 0)).not.toThrow();
  });

  it("refuses one past the limit with the facts and upgrade options", () => {
    let thrown: unknown;
    try {
      checkLimit(ent, "seats", 10, 1);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(LimitReachedError);
    expect(thrown).toBeInstanceOf(DomainError);
    expect(thrown).toMatchObject({
      kind: "limit_reached",
      code: "LIMIT_REACHED",
      details: {
        metric: "seats",
        limit: 10,
        current: 10,
        increment: 1,
        planId: "free",
        upgrade: { planIds: ["pro"], addonIds: ["extra_seats"] },
      },
    });
  });

  it("never refuses an unlimited metric", () => {
    const unlimited = entitlements(UNLIMITED_PLAN, [], []);
    expect(() =>
      checkLimit(unlimited, "storage_bytes", 10 ** 15, 10 ** 12)
    ).not.toThrow();
  });
});

describe("requireIncluded", () => {
  it("passes an included feature and refuses a missing one with upgrades", () => {
    expect(() =>
      requireIncluded(entitlements(pro, [], []), "files.presigned_upload")
    ).not.toThrow();
    expect(() =>
      requireIncluded(entitlements(free, [], []), "files.presigned_upload")
    ).toThrow(FeatureNotIncludedError);
    try {
      requireIncluded(entitlements(free, [], []), "files.presigned_upload");
    } catch (error) {
      expect(error).toMatchObject({
        kind: "limit_reached",
        code: "FEATURE_NOT_INCLUDED",
        details: {
          feature: "files.presigned_upload",
          planId: "free",
          upgrade: { planIds: ["pro"], addonIds: ["direct_uploads"] },
        },
      });
    }
  });
});
