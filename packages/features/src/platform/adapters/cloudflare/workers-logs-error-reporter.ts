import type { RequestContext } from "../../../kernel";
import type { ErrorReporter, LogFields } from "../../ports";
import { requestContextFields } from "../../request-context";
import { createWorkersLogsLogger } from "./workers-logs-logger";

/** The event name of an error report in Workers Logs; filter on it to list errors. */
export const ERROR_REPORT_EVENT = "error.captured";

/**
 * ErrorReporter adapter that writes each report as one structured error line to Workers
 * Logs: the error (name, message, stack, cause), the request context and `extra`. Search
 * Workers Logs for the reference (`requestId`) a user quotes to find it.
 */
export function createWorkersLogsErrorReporter(): ErrorReporter {
  const logger = createWorkersLogsLogger();
  return {
    capture(error: unknown, context: RequestContext, extra?: LogFields) {
      logger.error(ERROR_REPORT_EVENT, {
        ...extra,
        ...requestContextFields(context),
        error,
      });
      return context.requestId;
    },
  };
}
