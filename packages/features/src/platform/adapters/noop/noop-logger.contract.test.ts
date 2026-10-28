import { describeLoggerContract } from "../../ports/logger.contract";
import { noopLogger } from "./noop-logger";

describeLoggerContract("noopLogger", () => ({ logger: noopLogger }));
