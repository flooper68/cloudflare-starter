import { DomainError } from "../../kernel";

/** The person has no connection to that client (or it is someone else's). */
export class AgentNotFoundError extends DomainError {
  constructor() {
    super("not_found", "Connected agent not found", "AGENT_NOT_FOUND");
  }
}
