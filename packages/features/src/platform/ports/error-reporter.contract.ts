/**
 * The ErrorReporter contract: every adapter's `*.contract.test.ts` runs this suite against
 * it. Test support only (not exported from the barrel, not bundled).
 */
import { afterEach, describe, expect, it } from "vitest";

import type { RequestContext } from "../../kernel";
import type { ErrorReporter } from "./error-reporter";

/**
 * One report as the adapter recorded or emitted it, as an OpenTelemetry log record:
 * `trace_id`, `span_id` and `attributes` with the exception.* conventions.
 */
export type ObservedReport = Readonly<{
  trace_id?: unknown;
  span_id?: unknown;
  attributes?: Readonly<Record<string, unknown>>;
}>;

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
    traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
    spanId: "00f067aa0ba902b7",
    parentSpanId: null,
    traceFlags: "01",
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

    it("returns the trace id as the reference", () => {
      const { reporter } = harness();
      expect(reporter.capture(new Error("boom"), contractContext())).toBe(
        contractContext().traceId
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

    it("records one report per capture with exception.*, trace ids, context and extra", () => {
      const { reporter, reports } = harness();
      reporter.capture(
        new RangeError("quota exceeded"),
        contractContext({ source: "queue", userId: "user-2" }),
        { "messaging.message.id": "m-1" }
      );
      const all = reports?.() ?? [];
      expect(all).toHaveLength(1);
      expect(all[0]).toMatchObject({
        trace_id: contractContext().traceId,
        span_id: contractContext().spanId,
        attributes: {
          "exception.type": "RangeError",
          "exception.message": "quota exceeded",
          "exception.stacktrace": expect.stringContaining("quota exceeded"),
          "app.request.source": "queue",
          "user.id": "user-2",
          "messaging.message.id": "m-1",
        },
      });
      expect(JSON.stringify(all[0])).not.toContain("203.0.113.7");
    });
  });
}
