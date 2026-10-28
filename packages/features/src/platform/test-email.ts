import type { EmailRecipient, SendEmailInput } from "./ports";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** The message of the email demo (`email.sendTest`): a test mail naming the environment. */
export function testEmail(input: {
  readonly to: EmailRecipient;
  readonly environment: string;
}): SendEmailInput {
  const name = input.to.name ?? "there";
  return {
    to: input.to,
    subject: `[${input.environment}] Starter kit test email`,
    html: `<p>Hello ${escapeHtml(name)},</p><p>This is a test email from Cloudflare Starter running in <strong>${escapeHtml(input.environment)}</strong>.</p>`,
    text: `Hello ${name}, this is a Cloudflare Starter test email from ${input.environment}.`,
  };
}
