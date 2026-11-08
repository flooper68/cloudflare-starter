import PostalMime from "postal-mime";

import { type InboxEnv, MAX_MESSAGE_BYTES } from "./env";
import { insertMessage } from "./store";

/** Whether `address` is directly in `domain` (not a subdomain of it). */
export function inDomain(address: string, domain: string): boolean {
  const lower = address.trim().toLowerCase();
  const at = lower.lastIndexOf("@");
  return at > 0 && lower.slice(at + 1) === domain.toLowerCase();
}

/**
 * Email Routing's handler: stores a mail to the QA domain, rejects anything else (wrong
 * domain, too large, unparsable). It never forwards or replies: QA mail stays here.
 */
export async function receiveEmail(
  message: ForwardableEmailMessage,
  env: InboxEnv,
  now: () => number = Date.now
): Promise<void> {
  const domain = env.QA_EMAIL_DOMAIN;
  if (!domain || !inDomain(message.to, domain)) {
    message.setReject("This address does not accept mail.");
    return;
  }
  if (message.rawSize > MAX_MESSAGE_BYTES) {
    message.setReject("Message too large.");
    return;
  }
  // message.raw can be read once: buffer it, then parse.
  const raw = await new Response(message.raw).arrayBuffer();
  let parsed: Awaited<ReturnType<typeof PostalMime.parse>>;
  try {
    parsed = await PostalMime.parse(raw);
  } catch {
    message.setReject("Message could not be parsed.");
    return;
  }
  const date =
    parsed.date && !Number.isNaN(Date.parse(parsed.date))
      ? new Date(parsed.date).toISOString()
      : null;
  await insertMessage(env.INBOX, {
    id: crypto.randomUUID(),
    to: message.to.trim().toLowerCase(),
    from: parsed.from?.address ?? message.from,
    subject: parsed.subject ?? "",
    date,
    receivedAt: now(),
    text: parsed.text ?? null,
    html: parsed.html ?? null,
    headers: parsed.headers.map(({ key, value }) => [key, value] as const),
  });
}
