import type { RequestContext } from "../../../kernel";
import type { ErrorReporter, LogFields } from "../../ports";

export interface CapturedError {
  readonly error: unknown;
  readonly context: RequestContext;
  readonly extra: LogFields;
  readonly reference: string;
}

/** An error reporter that keeps its reports in memory. */
export interface MemoryErrorReporter extends ErrorReporter {
  readonly captured: readonly CapturedError[];
}

/** ErrorReporter for tests: assert on `captured` instead of spying on the console. */
export function createMemoryErrorReporter(): MemoryErrorReporter {
  const captured: CapturedError[] = [];
  return {
    captured,
    capture(error, context, extra = {}) {
      captured.push({ error, context, extra, reference: context.requestId });
      return context.requestId;
    },
  };
}
