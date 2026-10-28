// In-memory adapters for tests: they record what the app sent so tests can assert on it.
export {
  type CapturedError,
  createMemoryErrorReporter,
  type MemoryErrorReporter,
} from "./memory-error-reporter";
export { createMemoryLogger, type MemoryLogger } from "./memory-logger";
