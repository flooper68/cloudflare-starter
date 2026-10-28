import { describe, expect, it } from "vitest";

import { createPointBudget, undeliverableReason } from "./analytics-delivery";

const layout = { strings: ["kind"], numbers: [] };

describe("undeliverableReason", () => {
  it("accepts catalog-shaped names and $identify", () => {
    expect(undeliverableReason("files.uploaded", layout)).toBeNull();
    expect(undeliverableReason("workspaces.member_joined", layout)).toBeNull();
    expect(undeliverableReason("$identify", layout)).toBeNull();
  });

  it("refuses other names and over-long ones", () => {
    expect(undeliverableReason("File Uploaded", layout)).toMatch(/not/);
    expect(undeliverableReason("uploaded", layout)).toMatch(/not/);
    expect(undeliverableReason(`files.${"x".repeat(60)}`, layout)).toMatch(
      /longer than 64/
    );
  });

  it("refuses layouts over the slot limits", () => {
    const strings = Array.from({ length: 15 }, (_, i) => `s${i}`);
    const numbers = Array.from({ length: 21 }, (_, i) => `n${i}`);
    expect(
      undeliverableReason("files.uploaded", { strings, numbers: [] })
    ).toMatch(/15 string properties/);
    expect(
      undeliverableReason("files.uploaded", { strings: [], numbers })
    ).toMatch(/21 numeric properties/);
  });
});

describe("createPointBudget", () => {
  it("allows the limit, then refuses", () => {
    const budget = createPointBudget(2);
    expect([budget.take(), budget.take(), budget.take()]).toEqual([
      true,
      true,
      false,
    ]);
  });
});
