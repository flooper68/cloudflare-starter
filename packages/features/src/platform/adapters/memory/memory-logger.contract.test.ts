import type { LogLevel } from "../../ports";
import { describeLoggerContract } from "../../ports/logger.contract";
import { createMemoryLogger } from "./memory-logger";

describeLoggerContract("createMemoryLogger", () => {
  const logger = createMemoryLogger();
  return {
    logger,
    lines: () =>
      logger.records.map((record) => ({
        level: record.severity_text.toLowerCase() as LogLevel,
        record: { ...record },
      })),
  };
});
