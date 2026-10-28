import { describe, expect, it } from "vitest";

import type { EmailRecipient, SendEmailInput } from "../../ports";
import { describeEmailContract } from "../../ports/email.contract";
import { createCloudflareEmail } from "./cloudflare-email";

/** A send_email binding that records the builder messages it is given. */
function recordingBinding() {
  const messages: EmailMessageBuilder[] = [];
  const binding = {
    send: async (message: EmailMessageBuilder) => {
      messages.push(message);
      return { messageId: `m${messages.length}` };
    },
  } as unknown as SendEmail;
  return { binding, messages };
}

function recipientOf(to: EmailMessageBuilder["to"]): EmailRecipient {
  if (typeof to === "string") return { email: to };
  if (to && !Array.isArray(to)) return to;
  throw new Error("expected one recipient");
}

describeEmailContract("createCloudflareEmail", () => {
  const { binding, messages } = recordingBinding();
  return {
    email: createCloudflareEmail({
      binding,
      from: { email: "noreply@example.test", name: "Cloudflare Starter" },
    }),
    delivers: true,
    delivered: () =>
      messages.map(
        (message): SendEmailInput => ({
          to: recipientOf(message.to),
          subject: message.subject,
          text: message.text ?? "",
          html: message.html ?? "",
          ...(message.headers ? { headers: message.headers } : {}),
        })
      ),
  };
});

describe("createCloudflareEmail", () => {
  it("sends from the configured sender, by name and address", async () => {
    const { binding, messages } = recordingBinding();
    await createCloudflareEmail({
      binding,
      from: { email: "noreply@example.test", name: "Cloudflare Starter" },
    }).send({
      to: { email: "nicole@example.test" },
      subject: "Hello",
      text: "Hello",
      html: "<p>Hello</p>",
    });
    expect(messages).toEqual([
      {
        from: { email: "noreply@example.test", name: "Cloudflare Starter" },
        to: "nicole@example.test",
        subject: "Hello",
        text: "Hello",
        html: "<p>Hello</p>",
      },
    ]);
  });
});
