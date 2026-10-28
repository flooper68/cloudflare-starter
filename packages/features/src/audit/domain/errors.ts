import { DomainError } from "../../kernel";

/** An audit event or audit query that does not match the catalog or its rules. */
export class InvalidAuditInputError extends DomainError {
  constructor(message: string) {
    super("invalid_input", message);
  }
}
