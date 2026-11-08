import { isQaEmail } from "../abuse";
import type { Database } from "../database";
import type { Clock, Ids } from "../kernel";
import {
  assertEmailMessage,
  type EmailRecipient,
  type EmailService,
} from "../platform";
import { storeQaMail } from "./store-qa-mail";

/**
 * The email port with the QA outbox in front (QA_BYPASS=on): a message to a QA address
 * (`qa@` or `qa+<tag>@` in the QA mail domain, `isQaEmail`) is validated like any other and
 * stored in the QA outbox instead of being sent; every other message goes to `inner`
 * unchanged. The port sends to one recipient per call, so a mail to QA and real
 * recipients is already one call per recipient: each real one is still delivered.
 * Wired once in the composition root (apps/web/src/lib/env.ts), so every mail of every
 * feature is covered.
 */
export function withQaOutbox(
  inner: EmailService,
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    /** The From the message would have had (EMAIL_FROM). */
    readonly from: EmailRecipient;
    /** QA_EMAIL_DOMAIN. */
    readonly emailDomain: string;
  }
): EmailService {
  return {
    enabled: inner.enabled,
    async send(message) {
      if (!isQaEmail(message.to.email, deps.emailDomain)) {
        await inner.send(message);
        return;
      }
      assertEmailMessage(message);
      await storeQaMail(deps, { from: deps.from, message });
    },
  };
}
