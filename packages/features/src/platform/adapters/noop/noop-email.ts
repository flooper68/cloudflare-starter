import { assertEmailMessage } from "../../email-message";
import type { EmailService } from "../../ports";

/**
 * Email off (no EMAIL binding or no EMAIL_FROM): `enabled` is false and nothing is sent.
 * Callers that can do without mail check `enabled`; auth links have their own fallback
 * (apps/web/src/server/auth-mail.ts).
 */
export const noopEmail: EmailService = {
  enabled: false,
  async send(input) {
    assertEmailMessage(input);
  },
};
