import { DomainError } from "../../kernel";

/** The note does not exist, is in the trash, or belongs to another workspace (indistinguishable on purpose). */
export class NoteNotFoundError extends DomainError {
  constructor() {
    super("not_found", "Note not found");
  }
}
