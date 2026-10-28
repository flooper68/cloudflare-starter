import { describe, expect, it } from "vitest";

import { testEmail } from "./test-email";

describe("testEmail", () => {
  it("names the environment and greets the recipient", () => {
    expect(
      testEmail({
        to: { email: "test@example.com", name: "Nicole" },
        environment: "local",
      })
    ).toMatchObject({
      to: { email: "test@example.com", name: "Nicole" },
      subject: "[local] Starter kit test email",
      text: "Hello Nicole, this is a Cloudflare Starter test email from local.",
    });
  });

  it("escapes the name in the HTML part", () => {
    expect(
      testEmail({
        to: { email: "t@example.com", name: "<b>Eve</b>" },
        environment: "local",
      }).html
    ).toContain("Hello &lt;b&gt;Eve&lt;/b&gt;,");
  });
});
