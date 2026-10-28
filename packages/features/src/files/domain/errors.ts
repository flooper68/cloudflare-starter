import { DomainError } from "../../kernel";

/** The file does not exist or belongs to another workspace (indistinguishable on purpose). */
export class FileNotFoundError extends DomainError {
  constructor() {
    super("not_found", "File not found");
  }
}

/** Presigned URLs need R2 API credentials that this environment does not have. */
export class PresignedUrlsUnavailableError extends DomainError {
  constructor(reason: string) {
    super("unavailable", reason);
  }
}
