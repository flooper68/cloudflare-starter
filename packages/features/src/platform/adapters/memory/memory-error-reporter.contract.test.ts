import { toLogRecord } from "../../log-record";
import { describeErrorReporterContract } from "../../ports/error-reporter.contract";
import { createMemoryErrorReporter } from "./memory-error-reporter";
import { TEST_RESOURCE } from "./memory-logger";

describeErrorReporterContract("createMemoryErrorReporter", () => {
  const reporter = createMemoryErrorReporter();
  return {
    reporter,
    // The record a logging reporter would write for each captured error.
    reports: () =>
      reporter.captured.map((report) =>
        toLogRecord({
          level: "error",
          event: "error.captured",
          fields: { ...report.extra, error: report.error },
          context: report.context,
          resource: TEST_RESOURCE,
          now: new Date(0),
        })
      ),
  };
});
