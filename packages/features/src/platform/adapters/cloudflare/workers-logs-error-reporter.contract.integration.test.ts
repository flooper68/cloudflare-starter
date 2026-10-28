// Runs in workerd (features-integration): reports are error lines on the console, as
// Workers Logs receives them.
import { vi } from "vitest";

import { describeErrorReporterContract } from "../../ports/error-reporter.contract";
import {
  createWorkersLogsErrorReporter,
  ERROR_REPORT_EVENT,
} from "./workers-logs-error-reporter";

describeErrorReporterContract("createWorkersLogsErrorReporter", () => {
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  return {
    reporter: createWorkersLogsErrorReporter(),
    reports: () =>
      spy.mock.calls
        .map((args) => args[0] as Record<string, unknown>)
        .filter((record) => record.event === ERROR_REPORT_EVENT),
    dispose: () => spy.mockRestore(),
  };
});
