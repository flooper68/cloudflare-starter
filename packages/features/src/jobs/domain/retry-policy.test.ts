import { describe, expect, it } from "vitest";

import { DomainError } from "../../kernel";
import { JobLockedError, UnknownJobTypeError } from "./errors";
import { classifyJobFailure } from "./retry-policy";

const delivery = (attempts: number) => ({ attempts, maxRetries: 5 });

describe("classifyJobFailure", () => {
  it.each(["invalid_input", "forbidden", "not_found"] as const)(
    "treats a DomainError of kind %s as permanent on any attempt",
    (kind) => {
      expect(classifyJobFailure(new DomainError(kind, "no"), delivery(1))).toBe(
        "permanent"
      );
      expect(classifyJobFailure(new DomainError(kind, "no"), delivery(6))).toBe(
        "permanent"
      );
    }
  );

  it("treats an unknown job type as permanent", () => {
    expect(
      classifyJobFailure(new UnknownJobTypeError("x.y"), delivery(1))
    ).toBe("permanent");
  });

  it.each([
    ["an unexpected error", new Error("D1 timeout")],
    ["a thrown string", "boom"],
    ["a conflict", new JobLockedError("k")],
    ["an unavailable service", new DomainError("unavailable", "down")],
  ])("retries %s before the final attempt", (_, error) => {
    for (const attempts of [1, 2, 5]) {
      expect(classifyJobFailure(error, delivery(attempts))).toBe("retry");
    }
  });

  it("calls attempt max_retries + 1 the final one", () => {
    expect(classifyJobFailure(new Error("x"), delivery(6))).toBe("final");
    expect(classifyJobFailure(new Error("x"), delivery(7))).toBe("final");
    expect(
      classifyJobFailure(new Error("x"), { attempts: 1, maxRetries: 0 })
    ).toBe("final");
  });
});
