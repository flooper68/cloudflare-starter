import type { RequestContext } from "../../../kernel";
import type { ErrorReporter, LogFields } from "../../ports";
import {
  createWorkersLogsLogger,
  type WorkersLogsLoggerOptions,
} from "./workers-logs-logger";

/** The body of an error report in Workers Logs; filter on it to list errors. */
export const ERROR_REPORT_EVENT = "error.captured";

/**
 * ErrorReporter adapter that writes each report as one ERROR log record to Workers Logs,
 * with the OpenTelemetry exception attributes (`exception.type`, `exception.message`,
 * `exception.stacktrace`), the trace and span ids of the work that failed and `extra`.
 * Search Workers Logs for `trace_id = <reference>` to find it.
 */
export function createWorkersLogsErrorReporter(
  options: WorkersLogsLoggerOptions
): ErrorReporter {
  const logger = createWorkersLogsLogger(options);
  return {
    capture(error: unknown, context: RequestContext, extra?: LogFields) {
      logger
        .withContext(context)
        .error(ERROR_REPORT_EVENT, { ...extra, error });
      return context.traceId;
    },
  };
}
