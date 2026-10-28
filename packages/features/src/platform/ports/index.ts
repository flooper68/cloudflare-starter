// Ports: the interfaces app code and features depend on for outside services. Adapters in
// platform/adapters/<vendor>/ implement them; apps/web/src/server/platform.ts picks one.
// The contract suites (*.contract.ts) are test support and stay out of this barrel.
export type { ErrorReporter } from "./error-reporter";
export type { LogFields, Logger, LogLevel } from "./logger";
