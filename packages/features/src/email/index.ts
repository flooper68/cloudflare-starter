export interface EmailRecipient {
  readonly email: string;
  readonly name?: string;
}

export interface SendEmailInput {
  readonly to: EmailRecipient;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

export interface SendTestEmailInput {
  readonly to: EmailRecipient;
  readonly environment: string;
}

/** Provider-neutral mailer. Swap the implementation, not the callers. */
export interface EmailService {
  send(input: SendEmailInput): Promise<void>;
  sendTestEmail(input: SendTestEmailInput): Promise<void>;
}

export interface CloudflareEmailConfig {
  /** The `send_email` binding (`env.EMAIL`). */
  readonly binding: SendEmail;
  /** Sender on a domain onboarded with `wrangler email sending enable`. */
  readonly from: EmailRecipient;
}

function address(recipient: EmailRecipient): string | EmailAddress {
  return recipient.name
    ? { email: recipient.email, name: recipient.name }
    : recipient.email;
}

/**
 * Cloudflare Email Service over the Workers binding: no API key, and in
 * `wrangler dev` the binding is simulated (mail is logged, not delivered).
 */
export function createCloudflareEmailService(
  config: CloudflareEmailConfig
): EmailService {
  async function send(input: SendEmailInput) {
    await config.binding.send({
      from: address(config.from),
      to: address(input.to),
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
  }

  return {
    send,
    async sendTestEmail(input) {
      await send({
        to: input.to,
        subject: `[${input.environment}] Starter kit test email`,
        html: `<p>Hello ${input.to.name ?? "there"},</p><p>This is a test email from Cloudflare Starter running in <strong>${input.environment}</strong>.</p>`,
        text: `Hello ${input.to.name ?? "there"}, this is a Cloudflare Starter test email from ${input.environment}.`,
      });
    },
  };
}
