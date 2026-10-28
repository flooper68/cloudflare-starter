import type { Clock, Ids } from "../../../kernel";
import type { LogResource } from "../../log-record";
import type { Tracer } from "../../ports";
import { createRecordTracer } from "../../record-tracer";
import type { SpanRecord } from "../../span-record";
import { TEST_RESOURCE } from "./memory-logger";

/** A tracer that keeps its span records in memory; bound tracers share the list. */
export interface MemoryTracer extends Tracer {
  /** Ended spans, in the order they ended. */
  readonly spans: readonly SpanRecord[];
  withContext(context: Parameters<Tracer["withContext"]>[0]): MemoryTracer;
}

/** Unique, readable ids for tests: 00000000-0000-4000-8000-<12 hex>, counting up. */
function sequentialIds(): Ids {
  let counter = 0;
  return {
    uuid: () => {
      counter += 1;
      return `00000000-0000-4000-8000-${counter.toString(16).padStart(12, "0")}`;
    },
  };
}

const FIXED_CLOCK: Clock = { now: () => new Date("2026-10-28T12:00:00.000Z") };

/**
 * Tracer for tests: assert on `spans` (OpenTelemetry span records) instead of spying on
 * the console.
 */
export function createMemoryTracer(
  options: {
    readonly resource?: LogResource;
    readonly clock?: Clock;
    readonly ids?: Ids;
  } = {}
): MemoryTracer {
  const spans: SpanRecord[] = [];
  const root = createRecordTracer({
    resource: options.resource ?? TEST_RESOURCE,
    clock: options.clock ?? FIXED_CLOCK,
    ids: options.ids ?? sequentialIds(),
    write: (record) => spans.push(record),
  });
  const wrap = (tracer: Tracer): MemoryTracer => ({
    startActiveSpan: tracer.startActiveSpan,
    startContextSpan: tracer.startContextSpan,
    withContext: (context) => wrap(tracer.withContext(context)),
    spans,
  });
  return wrap(root);
}
