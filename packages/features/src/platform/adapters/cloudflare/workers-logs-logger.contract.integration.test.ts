// Runs in workerd (features-integration): the adapter's real console output, as Workers
// Logs receives it.
import { vi } from "vitest";

import type { LogLevel } from "../../ports";
import { describeLoggerContract } from "../../ports/logger.contract";
import { createWorkersLogsLogger } from "./workers-logs-logger";

const LEVELS: readonly LogLevel[] = ["debug", "info", "warn", "error"];

describeLoggerContract("createWorkersLogsLogger", () => {
  const spies = LEVELS.map(
    (level) =>
      [level, vi.spyOn(console, level).mockImplementation(() => {})] as const
  );
  return {
    logger: createWorkersLogsLogger(),
    lines: () =>
      spies
        .flatMap(([level, spy]) =>
          spy.mock.calls.map((args, index) => ({
            level,
            order: spy.mock.invocationCallOrder[index] ?? 0,
            record: args[0] as Record<string, unknown>,
          }))
        )
        .sort((a, b) => a.order - b.order)
        .map(({ level, record }) => ({ level, record })),
    dispose: () => {
      for (const [, spy] of spies) spy.mockRestore();
    },
  };
});
