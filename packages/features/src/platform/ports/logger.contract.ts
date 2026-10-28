/**
 * The Logger contract: every adapter's `*.contract.test.ts` runs this suite against it.
 * Test support only (not exported from the barrel, not bundled).
 */
import { afterEach, describe, expect, it } from "vitest";

import type { Logger, LogLevel } from "./logger";

/** One line as the sink received it: the level it was written at and the record. */
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
    error: new Error("inner"),
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
          logger[level]("contract.event", { count: 1 })
        ).not.toThrow();
      }
    });

    it("never throws on fields that are not plain data", () => {
      const { logger } = harness();
      expect(() =>
        logger.error("contract.awkward", awkwardFields())
      ).not.toThrow();
    });

    it("child returns a logger and leaves the parent unchanged", () => {
      const { logger, lines } = harness();
      const child = logger.child({ requestId: "req-1" });
      child.info("contract.child");
      logger.info("contract.parent");
      if (!lines) return;
      const [fromChild, fromParent] = lines();
      expect(fromChild?.record).toMatchObject({
        event: "contract.child",
        requestId: "req-1",
      });
      expect(fromParent?.record.event).toBe("contract.parent");
      expect(fromParent?.record).not.toHaveProperty("requestId");
    });

    const observable = makeHarness();
    observable.dispose?.();
    if (!observable.lines) return;

    it("writes one line per call at its level, with event and fields", () => {
      const { logger, lines } = harness();
      for (const level of LEVELS) logger[level](`contract.${level}`, { n: 1 });
      expect(
        lines?.().map((line) => [
          line.level,
          line.record.level,
          line.record.event,
          line.record.n,
        ])
      ).toEqual(LEVELS.map((level) => [level, level, `contract.${level}`, 1]));
    });

    it("redacts secrets by key, at any depth", () => {
      const { logger, lines } = harness();
      logger.info("contract.secrets", {
        password: "hunter2",
        headers: { authorization: "Bearer abc", cookie: "s=1", accept: "*/*" },
        apiKey: "k",
        BETTER_AUTH_SECRET: "s",
      });
      const record = lines?.()[0]?.record;
      expect(JSON.stringify(record)).not.toMatch(/hunter2|Bearer abc|s=1/);
      expect(record).toMatchObject({
        password: "[redacted]",
        headers: {
          authorization: "[redacted]",
          cookie: "[redacted]",
          accept: "*/*",
        },
        apiKey: "[redacted]",
        BETTER_AUTH_SECRET: "[redacted]",
      });
    });

    it("serializes errors with name, message and stack", () => {
      const { logger, lines } = harness();
      logger.error("contract.error", { error: new TypeError("bad input") });
      expect(lines?.()[0]?.record.error).toMatchObject({
        name: "TypeError",
        message: "bad input",
        stack: expect.stringContaining("bad input"),
      });
    });

    it("emits JSON-safe records, marking circular references", () => {
      const { logger, lines } = harness();
      logger.warn("contract.awkward", awkwardFields());
      const record = lines?.()[0]?.record;
      expect(() => JSON.stringify(record)).not.toThrow();
      expect(record).toMatchObject({
        circular: { name: "loop", self: "[circular]" },
        throwing: "[unserializable]",
        big: "10",
      });
    });

    it("lets call fields override child fields but never level or event", () => {
      const { logger, lines } = harness();
      logger
        .child({ step: "outer", level: "x" })
        .child({ step: "inner" })
        .info("contract.merge", { event: "spoofed", extra: true });
      expect(lines?.()[0]?.record).toMatchObject({
        level: "info",
        event: "contract.merge",
        step: "inner",
        extra: true,
      });
    });
  });
}
