import { DomainError } from "../../kernel";

/** The key is not in the flag catalog (FLAGS). */
export class UnknownFlagError extends DomainError {
  constructor(key: string) {
    super("not_found", `Flag ${key} is not in the catalog`, "UNKNOWN_FLAG");
  }
}

/** A configured value does not have the flag's catalog type. */
export class FlagValueTypeError extends DomainError {
  constructor(key: string, expected: string, received: string) {
    super(
      "invalid_input",
      `Flag ${key} takes ${expected} values, not ${received}`,
      "FLAG_VALUE_TYPE_MISMATCH"
    );
  }
}

/** The configured provider keeps no configuration of its own (FEATURE_FLAGS=none). */
export class FlagStoreUnavailableError extends DomainError {
  constructor() {
    super(
      "unavailable",
      "Feature flags are not stored in this deployment: set FEATURE_FLAGS=d1 to manage them here",
      "FLAG_STORE_UNAVAILABLE"
    );
  }
}
