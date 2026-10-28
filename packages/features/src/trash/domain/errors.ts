import { DomainError } from "../../kernel";

/**
 * An item is not in the actor's trash: it does not exist, is live, or belongs to another
 * workspace (indistinguishable on purpose). Names the first such item.
 */
export class TrashItemNotFoundError extends DomainError {
  constructor(item: { readonly type: string; readonly id: string }) {
    super(
      "not_found",
      `Not in the trash: ${item.type} ${item.id}`,
      "TRASH_ITEM_NOT_FOUND"
    );
  }
}

/** A trash request the rules refuse: an unknown type, a bad cursor, a bad retention. */
export class InvalidTrashInputError extends DomainError {
  constructor(message: string) {
    super("invalid_input", message);
  }
}
