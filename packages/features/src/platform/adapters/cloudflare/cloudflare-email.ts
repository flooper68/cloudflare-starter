import { assertEmailMessage } from "../../email-message";
import type { EmailRecipient, EmailService } from "../../ports";

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
 * Email over Cloudflare Email Service's Workers binding: no API key, and in `wrangler dev`
 * the binding is simulated (the message is written under .wrangler/tmp/email/, not
 * delivered). Extra headers go through the binding's `headers` field.
 */
export function createCloudflareEmail(
  config: CloudflareEmailConfig
): EmailService {
  return {
    enabled: true,
    async send(input) {
      assertEmailMessage(input);
      await config.binding.send({
        from: address(config.from),
        to: address(input.to),
        subject: input.subject,
        text: input.text,
        html: input.html,
        ...(input.headers ? { headers: { ...input.headers } } : {}),
      });
    },
  };
}
