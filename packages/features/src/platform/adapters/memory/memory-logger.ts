import type { Clock } from "../../../kernel";
import type { LogRecord, LogResource } from "../../log-record";
import type { Logger } from "../../ports";
import { createRecordLogger } from "../../record-logger";

/** A logger that keeps its records in memory; children share the parent's list. */
export interface MemoryLogger extends Logger {
  readonly records: readonly LogRecord[];
}

export const TEST_RESOURCE: LogResource = {
  "service.name": "test",
  "service.version": "local",
  "deployment.environment.name": "test",
};

const FIXED_CLOCK: Clock = { now: () => new Date("2026-10-28T12:00:00.000Z") };

/** Logger for tests: assert on `records` (OpenTelemetry records) instead of spying on the console. */
export function createMemoryLogger(
  options: { readonly resource?: LogResource; readonly clock?: Clock } = {}
): MemoryLogger {
  const records: LogRecord[] = [];
  const logger = createRecordLogger({
    resource: options.resource ?? TEST_RESOURCE,
    clock: options.clock ?? FIXED_CLOCK,
    write: (record) => records.push(record),
  });
  return { ...logger, records };
}
