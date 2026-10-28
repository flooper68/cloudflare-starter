import { describe, expect, it } from "vitest";

import { notificationMail, unsubscribeUrl } from "./email-layout";

const content = {
  subject: "Grace joined Analytical Engines",
  text: "Grace accepted your invitation.",
  html: "<p><strong>Grace</strong> accepted your invitation.</p>",
};
const appUrl = "https://app.example.test";

describe("notificationMail", () => {
  it("adds the RFC 8058 headers and footer links when a link is given", () => {
    const link = unsubscribeUrl(appUrl, "abc.def");
    expect(link).toBe(
      "https://app.example.test/api/notifications/unsubscribe?t=abc.def"
    );
    const mail = notificationMail({
      appName: "Cloudflare Starter",
      appUrl,
      content,
      unsubscribeUrl: link,
    });
    expect(mail.headers).toEqual({
      "List-Unsubscribe": `<${link}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
    expect(mail.subject).toBe(content.subject);
    expect(mail.text).toContain(`Unsubscribe from these mails: ${link}`);
    expect(mail.html).toContain(content.html);
    expect(mail.html).toContain(`<a href="${link}">Unsubscribe</a>`);
    expect(mail.html).toContain(
      `href="${appUrl}/app/notifications/preferences"`
    );
  });

  it("has no unsubscribe header or link for security notices", () => {
    const mail = notificationMail({
      appName: "Cloudflare Starter",
      appUrl,
      content,
      unsubscribeUrl: null,
    });
    expect(mail.headers).toEqual({});
    expect(mail.html).not.toContain("Unsubscribe");
    expect(mail.text).toContain("security notice");
  });

  it("puts a subject built from names with line breaks on one line", () => {
    const mail = notificationMail({
      appName: "Cloudflare Starter",
      appUrl,
      content: { ...content, subject: "You are now Owner in Acme\r\nCorp" },
      unsubscribeUrl: null,
    });
    expect(mail.subject).toBe("You are now Owner in Acme Corp");
  });

  it("escapes the app name and URL in the layout", () => {
    const mail = notificationMail({
      appName: "<Acme>",
      appUrl: 'https://x.test/"onmouseover=',
      content,
      unsubscribeUrl: null,
    });
    expect(mail.html).toContain("&lt;Acme&gt;");
    expect(mail.html).not.toContain('"onmouseover=');
  });
});
