import type { ErrorReporter } from "../../ports";

/**
 * ErrorReporter that records nothing (`ERROR_REPORTER=none`) but still returns the trace
 * id, so users always get a reference to quote.
 */
export const noopErrorReporter: ErrorReporter = {
  capture: (_error, context) => context.traceId,
};
