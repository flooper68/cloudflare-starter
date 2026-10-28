/**
 * Email port: sends one message to one recipient. Adapters: cloudflare (the `send_email`
 * binding of Cloudflare Email Service), noop (email off: sends nothing, `enabled` false),
 * memory (records messages for tests). Every adapter validates the message with
 * `assertEmailMessage` first and passes `describeEmailContract` (email.contract.ts).
 *
 * Email is on when the EMAIL binding and EMAIL_FROM are set (apps/web/src/lib/env.ts);
 * otherwise the composition root hands out the noop adapter, and callers that can do
 * without mail (notifications) check `enabled` and skip it instead of pretending it went
 * out.
 */

export interface EmailRecipient {
  readonly email: string;
  readonly name?: string;
}

export interface SendEmailInput {
  readonly to: EmailRecipient;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
  /**
   * Extra header fields (`List-Unsubscribe`, `List-Unsubscribe-Post`). Names are RFC 5322
   * field names; values are one line. The adapter sets From, To, Subject and the body
   * headers itself, so those names are refused.
   */
  readonly headers?: Readonly<Record<string, string>>;
}

export interface EmailService {
  /** False only when email is off (the noop adapter): nothing is delivered. */
  readonly enabled: boolean;
  /** Sends the message; rejects an invalid one with a TypeError before anything is sent. */
  send(input: SendEmailInput): Promise<void>;
}
