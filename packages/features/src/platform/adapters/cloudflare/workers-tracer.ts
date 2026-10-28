import type { Clock, Ids } from "../../../kernel";
import { systemClock } from "../../clock";
import { randomIds } from "../../ids";
import type { LogResource } from "../../log-record";
import type { Tracer } from "../../ports";
import { createRecordTracer } from "../../record-tracer";

export interface WorkersTracerOptions {
  readonly resource: LogResource;
  readonly clock?: Clock;
  readonly ids?: Ids;
}

/**
 * Tracer adapter for Cloudflare Workers: each ended span is one OpenTelemetry span record
 * (span-record.ts, body `trace.span`) written to the console as an object, which Workers
 * Logs indexes field by field and Workers OTel export forwards. The spans share the W3C
 * trace id of the request context, so a request's spans and logs are found together with
 * `trace_id = <reference>`. Workers automatic tracing (`observability.traces`) adds the
 * platform's own spans (handler, fetch, bindings) under the runtime's trace ids.
 */
export function createWorkersTracer(options: WorkersTracerOptions): Tracer {
  return createRecordTracer({
    resource: options.resource,
    clock: options.clock ?? systemClock,
    ids: options.ids ?? randomIds,
    write: (record) =>
      record.severity_text === "ERROR"
        ? console.error(record)
        : console.info(record),
  });
}
