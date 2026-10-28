import { assertEmailMessage } from "../../email-message";
import type { EmailService, SendEmailInput } from "../../ports";

/** An email service that keeps what was sent in memory. */
export interface MemoryEmail extends EmailService {
  readonly sent: readonly SendEmailInput[];
}

/** Email for tests: assert on `sent` instead of spying on a binding. */
export function createMemoryEmail(): MemoryEmail {
  const sent: SendEmailInput[] = [];
  return {
    enabled: true,
    sent,
    async send(input) {
      assertEmailMessage(input);
      sent.push(input);
    },
  };
}
