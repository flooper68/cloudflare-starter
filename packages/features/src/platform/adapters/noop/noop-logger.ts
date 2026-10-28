import type { Logger } from "../../ports";

/** Logger that discards everything (`LOG_SINK=none`). */
export const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => noopLogger,
  withContext: () => noopLogger,
};
