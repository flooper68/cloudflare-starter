import { describeErrorReporterContract } from "../../ports/error-reporter.contract";
import { noopErrorReporter } from "./noop-error-reporter";

describeErrorReporterContract("noopErrorReporter", () => ({
  reporter: noopErrorReporter,
}));
