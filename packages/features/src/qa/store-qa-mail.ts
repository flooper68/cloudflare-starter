import type { Database } from "../database";
import type { Clock, Ids } from "../kernel";
import type { EmailRecipient, SendEmailInput } from "../platform";
import { formatMailbox, renderedHeaders } from "./domain";
import { qaOutbox } from "./qa.schema";

/**
 * Stores one message to a QA address in the QA outbox instead of sending it: recipient,
 * sender, subject, both bodies and every header it would have carried
 * (`renderedHeaders`). Called only by the QA outbox email adapter (with-qa-outbox.ts).
 */
export async function storeQaMail(
  deps: { readonly db: Database; readonly clock: Clock; readonly ids: Ids },
  input: { readonly from: EmailRecipient; readonly message: SendEmailInput }
): Promise<{ readonly id: string }> {
  const id = deps.ids.uuid();
  const now = deps.clock.now();
  const { message } = input;
  await deps.db.insert(qaOutbox).values({
    id,
    recipient: message.to.email.trim().toLowerCase(),
    // As the From header reads, display name included: what a mail client shows.
    sender: formatMailbox(input.from),
    subject: message.subject,
    textBody: message.text,
    htmlBody: message.html,
    headers: renderedHeaders({
      from: input.from,
      to: message.to,
      subject: message.subject,
      id,
      date: now,
      headers: message.headers,
    }),
    createdAt: now,
  });
  return { id };
}
