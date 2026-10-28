/**
 * The ErrorReporter contract: every adapter's `*.contract.test.ts` runs this suite against
 * it. Test support only (not exported from the barrel, not bundled).
 */
import { afterEach, describe, expect, it } from "vitest";

import type { RequestContext } from "../../kernel";
import type { ErrorReporter } from "./error-reporter";

/** One report as the adapter recorded or emitted it, flattened to its fields. */
export type ObservedReport = Readonly<Record<string, unknown>>;

export interface ErrorReporterHarness {
  readonly reporter: ErrorReporter;
  /** What the adapter reported. Omit for adapters that discard everything (noop). */
  readonly reports?: () => readonly ObservedReport[];
  readonly dispose?: () => void;
}

export function contractContext(
  overrides: Partial<RequestContext> = {}
): RequestContext {
  return {
    requestId: "8f14e45f-ceea-467a-9575-0f4c5e9b2c11",
    source: "http",
    userId: "user-1",
    workspaceId: null,
    ip: "203.0.113.7",
    release: "local",
    environment: "local",
    ...overrides,
  };
}

export function describeErrorReporterContract(
  name: string,
  makeHarness: () => ErrorReporterHarness
): void {
  describe(`${name} satisfies the ErrorReporter contract`, () => {
    const made: ErrorReporterHarness[] = [];
    const harness = () => {
      const created = makeHarness();
      made.push(created);
      return created;
    };
    afterEach(() => {
      for (const created of made.splice(0)) created.dispose?.();
    });

    it("returns the request id as the reference", () => {
      const { reporter } = harness();
      expect(reporter.capture(new Error("boom"), contractContext())).toBe(
        contractContext().requestId
      );
    });

    it("never throws, whatever was thrown", () => {
      const { reporter } = harness();
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      for (const thrown of [
        "a string",
        null,
        undefined,
        42,
        circular,
        new Error("with cause", { cause: circular }),
      ]) {
        expect(() =>
          reporter.capture(thrown, contractContext(), { circular })
        ).not.toThrow();
      }
    });

    const observable = makeHarness();
    observable.dispose?.();
    if (!observable.reports) return;

    it("records one report per capture with the error, its stack and the context", () => {
      const { reporter, reports } = harness();
      reporter.capture(
        new RangeError("quota exceeded"),
        contractContext({ source: "queue", userId: "user-2" }),
        { messageId: "m-1" }
      );
      const all = reports?.() ?? [];
      expect(all).toHaveLength(1);
      expect(all[0]).toMatchObject({
        requestId: contractContext().requestId,
        source: "queue",
        userId: "user-2",
        release: "local",
        environment: "local",
        messageId: "m-1",
        error: {
          name: "RangeError",
          message: "quota exceeded",
          stack: expect.stringContaining("quota exceeded"),
        },
      });
    });
  });
}
