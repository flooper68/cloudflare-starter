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

export interface EmailService {
  send(input: SendEmailInput): Promise<void>;
  sendTestEmail(input: SendTestEmailInput): Promise<void>;
}

export interface MailjetConfig {
  readonly apiKey: string;
  readonly secretKey: string;
  readonly fromEmail: string;
  readonly fromName: string;
  readonly sandbox: boolean;
}

export function createMailjetEmailService(config: MailjetConfig): EmailService {
  async function send(input: SendEmailInput) {
    const auth = btoa(`${config.apiKey}:${config.secretKey}`);

    const response = await fetch("https://api.mailjet.com/v3.1/send", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        SandboxMode: config.sandbox,
        Messages: [
          {
            From: {
              Email: config.fromEmail,
              Name: config.fromName,
            },
            To: [
              {
                Email: input.to.email,
                ...(input.to.name ? { Name: input.to.name } : {}),
              },
            ],
            Subject: input.subject,
            HTMLPart: input.html,
            TextPart: input.text,
          },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Mailjet send failed (${response.status}): ${text}`);
    }
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
