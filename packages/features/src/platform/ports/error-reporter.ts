import type { RequestContext } from "../../kernel";
import type { LogFields } from "./logger";

/**
 * Port: reports an unexpected error with the context of the work that failed. Synchronous
 * and never throws: an adapter that ships errors over the network does it inside
 * `ctx.waitUntil`. Returns the reference a user can quote to find the report, which is the
 * trace id. Implementations pass `describeErrorReporterContract`
 * (error-reporter.contract.ts).
 */
export interface ErrorReporter {
  capture(error: unknown, context: RequestContext, extra?: LogFields): string;
}
