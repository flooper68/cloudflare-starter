import { sanitize } from "../../log-record";
import { describeErrorReporterContract } from "../../ports/error-reporter.contract";
import { requestContextFields } from "../../request-context";
import { createMemoryErrorReporter } from "./memory-error-reporter";

describeErrorReporterContract("createMemoryErrorReporter", () => {
  const reporter = createMemoryErrorReporter();
  return {
    reporter,
    reports: () =>
      reporter.captured.map((report) => ({
        ...report.extra,
        ...requestContextFields(report.context),
        error: sanitize(report.error),
      })),
  };
});
