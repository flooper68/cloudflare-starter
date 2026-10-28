/**
 * The Logger contract: every adapter's `*.contract.test.ts` runs this suite against it.
 * Records follow the OpenTelemetry Logs Data Model (see ../log-record.ts).
 * Test support only (not exported from the barrel, not bundled).
 */
import { afterEach, describe, expect, it } from "vitest";

import type { RequestContext } from "../../kernel";
import type { Logger, LogLevel } from "./logger";

/** One record as the sink received it: the level it was written at and the record. */
export interface ObservedLine {
  readonly level: LogLevel;
  readonly record: Readonly<Record<string, unknown>>;
}

export interface LoggerHarness {
  readonly logger: Logger;
  /** What the adapter emitted. Omit for adapters that discard everything (noop). */
  readonly lines?: () => readonly ObservedLine[];
  /** Undo spies or other global changes the harness made. */
  readonly dispose?: () => void;
}

const LEVELS: readonly LogLevel[] = ["debug", "info", "warn", "error"];
const SEVERITY: Record<LogLevel, readonly [string, number]> = {
  debug: ["DEBUG", 5],
  info: ["INFO", 9],
  warn: ["WARN", 13],
  error: ["ERROR", 17],
};

export const CONTRACT_CONTEXT: RequestContext = {
  traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
  spanId: "00f067aa0ba902b7",
  parentSpanId: null,
  traceFlags: "01",
  source: "http",
  userId: "user-1",
  workspaceId: "ws-1",
  ip: "203.0.113.7",
  release: "local",
  environment: "local",
};

function awkwardFields() {
  const circular: Record<string, unknown> = { name: "loop" };
  circular.self = circular;
  const throwing = {
    get boom(): never {
      throw new Error("getter failed");
    },
  };
  return {
    circular,
    throwing,
    big: 10n,
    nothing: undefined,
    fn: () => 1,
    nested: new Error("inner"),
  };
}

export function describeLoggerContract(
  name: string,
  makeHarness: () => LoggerHarness
): void {
  describe(`${name} satisfies the Logger contract`, () => {
    const made: LoggerHarness[] = [];
    const harness = () => {
      const created = makeHarness();
      made.push(created);
      return created;
    };
    afterEach(() => {
      for (const created of made.splice(0)) created.dispose?.();
    });

    it("accepts every level with and without fields", () => {
      const { logger } = harness();
      for (const level of LEVELS) {
        expect(() => logger[level]("contract.event")).not.toThrow();
        expect(() =>
          logger[level]("contract.event", { "app.count": 1 })
        ).not.toThrow();
      }
    });

    it("never throws on fields that are not plain data", () => {
      const { logger } = harness();
      expect(() =>
        logger.error("contract.awkward", {
          ...awkwardFields(),
          error: awkwardFields(),
        })
      ).not.toThrow();
    });

    it("child and withContext return loggers and leave the parent unchanged", () => {
      const { logger, lines } = harness();
      logger.child({ "app.step": "child" }).info("contract.child");
      logger.withContext(CONTRACT_CONTEXT).info("contract.context");
      logger.info("contract.parent");
      if (!lines) return;
      const [fromChild, fromContext, fromParent] = lines();
      expect(fromChild?.record.attributes).toMatchObject({
        "app.step": "child",
      });
      expect(fromContext?.record.trace_id).toBe(CONTRACT_CONTEXT.traceId);
      expect(fromParent?.record.body).toBe("contract.parent");
      expect(fromParent?.record.attributes).not.toHaveProperty("app.step");
      expect(fromParent?.record).not.toHaveProperty("trace_id");
    });

    const observable = makeHarness();
    observable.dispose?.();
    if (!observable.lines) return;

    it("writes one OpenTelemetry record per call: timestamp, severity, body, attributes, resource", () => {
      const { logger, lines } = harness();
      for (const level of LEVELS)
        logger[level](`contract.${level}`, { "app.n": 1 });
      const all = lines?.() ?? [];
      expect(all.map((line) => line.level)).toEqual(LEVELS);
      for (const [index, level] of LEVELS.entries()) {
        const record = all[index]?.record;
        expect(record).toMatchObject({
          severity_text: SEVERITY[level][0],
          severity_number: SEVERITY[level][1],
          body: `contract.${level}`,
          attributes: { "app.n": 1 },
          resource: {
            "service.name": expect.any(String),
            "service.version": expect.any(String),
            "deployment.environment.name": expect.any(String),
          },
        });
        expect(Number.isNaN(Date.parse(String(record?.timestamp)))).toBe(false);
      }
    });

    it("carries trace_id, span_id and the context attributes, never the IP", () => {
      const { logger, lines } = harness();
      logger.withContext(CONTRACT_CONTEXT).warn("contract.traced");
      const record = lines?.()[0]?.record;
      expect(record).toMatchObject({
        trace_id: "4bf92f3577b34da6a3ce929d0e0e4736",
        span_id: "00f067aa0ba902b7",
        trace_flags: "01",
        attributes: {
          "user.id": "user-1",
          "app.workspace.id": "ws-1",
          "app.request.source": "http",
        },
      });
      expect(JSON.stringify(record)).not.toContain("203.0.113.7");
    });

    it("redacts secrets by key, at any depth", () => {
      const { logger, lines } = harness();
      logger.info("contract.secrets", {
        password: "hunter2",
        "http.request.header.authorization": "Bearer abc",
        headers: { cookie: "s=1", accept: "*/*" },
        apiKey: "k",
        BETTER_AUTH_SECRET: "s",
      });
      const record = lines?.()[0]?.record;
      expect(JSON.stringify(record)).not.toMatch(/hunter2|Bearer abc|s=1/);
      expect(record?.attributes).toMatchObject({
        password: "[redacted]",
        "http.request.header.authorization": "[redacted]",
        headers: { cookie: "[redacted]", accept: "*/*" },
        apiKey: "[redacted]",
        BETTER_AUTH_SECRET: "[redacted]",
      });
    });

    it("maps an Error under `error` to the exception.* attributes", () => {
      const { logger, lines } = harness();
      logger.error("contract.error", { error: new TypeError("bad input") });
      expect(lines?.()[0]?.record.attributes).toMatchObject({
        "exception.type": "TypeError",
        "exception.message": "bad input",
        "exception.stacktrace": expect.stringContaining("bad input"),
      });
    });

    it("emits JSON-safe records, marking circular references", () => {
      const { logger, lines } = harness();
      logger.warn("contract.awkward", awkwardFields());
      const record = lines?.()[0]?.record;
      expect(() => JSON.stringify(record)).not.toThrow();
      expect(record?.attributes).toMatchObject({
        circular: { name: "loop", self: "[circular]" },
        throwing: "[unserializable]",
        big: "10",
      });
    });

    it("lets call fields override child fields", () => {
      const { logger, lines } = harness();
      logger
        .child({ "app.step": "outer" })
        .child({ "app.step": "inner", "app.kept": true })
        .info("contract.merge", { "app.step": "call" });
      expect(lines?.()[0]?.record.attributes).toMatchObject({
        "app.step": "call",
        "app.kept": true,
      });
    });
  });
}
