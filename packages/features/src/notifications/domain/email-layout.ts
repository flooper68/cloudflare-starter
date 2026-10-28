import { html, SafeHtml } from "../../kernel";

/** Where the footer links point, relative to APP_URL. */
export const PREFERENCES_PATH = "/app/notifications/preferences";
export const UNSUBSCRIBE_API_PATH = "/api/notifications/unsubscribe";

export interface NotificationMail {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
  /** RFC 8058 one-click unsubscribe headers, absent for security notifications. */
  readonly headers: Readonly<Record<string, string>>;
}

/** The absolute one-click unsubscribe URL for a signed token. */
export function unsubscribeUrl(appUrl: string, token: string): string {
  return `${appUrl}${UNSUBSCRIBE_API_PATH}?t=${encodeURIComponent(token)}`;
}

/**
 * Wraps a rendered notification in the mail layout: the body, a footer with the
 * preferences link and, unless the notification is security-critical, an unsubscribe
 * link plus the RFC 8058 headers (`List-Unsubscribe` with the HTTPS URL,
 * `List-Unsubscribe-Post: List-Unsubscribe=One-Click`). `content.html` is trusted markup
 * from a definition's `render` (built with the escaping `html` tag).
 */
export function notificationMail(input: {
  readonly appName: string;
  readonly appUrl: string;
  readonly content: {
    readonly subject: string;
    readonly text: string;
    readonly html: string;
  };
  /** The signed unsubscribe URL, or null for security notifications. */
  readonly unsubscribeUrl: string | null;
}): NotificationMail {
  const preferences = `${input.appUrl}${PREFERENCES_PATH}`;
  const footerText = input.unsubscribeUrl
    ? `Choose which mail you get: ${preferences}\nUnsubscribe from these mails: ${input.unsubscribeUrl}`
    : `This is a security notice about your ${input.appName} account and is always sent.\nYour notification settings: ${preferences}`;
  const footerHtml = input.unsubscribeUrl
    ? html`<a href="${preferences}">Notification settings</a> · <a href="${input.unsubscribeUrl}">Unsubscribe</a>`
    : html`This is a security notice about your ${input.appName} account and is always sent. <a href="${preferences}">Notification settings</a>`;
  return {
    // Names in a subject may contain line breaks; a mail header may not.
    subject: input.content.subject.replace(/\s+/g, " ").trim(),
    text: `${input.content.text}\n\n--\n${footerText}\n`,
    html: html`<!doctype html><html><body style="margin:0;padding:24px;font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.5;color:#1f2328;background:#ffffff"><div style="max-width:560px;margin:0 auto">${new SafeHtml(input.content.html)}<hr style="border:none;border-top:1px solid #d0d7de;margin:24px 0 12px"><p style="font-size:12px;color:#59636e">${footerHtml}</p></div></body></html>`
      .value,
    headers: input.unsubscribeUrl
      ? {
          "List-Unsubscribe": `<${input.unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        }
      : {},
  };
}
