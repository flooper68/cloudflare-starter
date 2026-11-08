import { describe, expect, it } from "vitest";

import {
  formatMailbox,
  isQaRunAddress,
  QA_OUTBOX_RETENTION_MS,
  qaOutboxCutoff,
  renderedHeaders,
} from "./outbox";

describe("formatMailbox", () => {
  it("shows the display name in quotes before the address, as a From header does", () => {
    expect(
      formatMailbox({ email: "starter@flooper.me", name: "Cloudflare Starter" })
    ).toBe('"Cloudflare Starter" <starter@flooper.me>');
  });

  it("is the bare address without a name, and drops quotes and backslashes from a name", () => {
    expect(formatMailbox({ email: "a@b.test" })).toBe("a@b.test");
    expect(formatMailbox({ email: "a@b.test", name: 'Ada "\\" L' })).toBe(
      '"Ada  L" <a@b.test>'
    );
  });
});

describe("isQaRunAddress", () => {
  it.each([
    "qa+20261108kqzt-owner@qa.example.com",
    "QA+20261108KQZT-Owner@QA.example.com",
  ])("serves %s", (email) => {
    expect(isQaRunAddress(email, "qa.example.com")).toBe(true);
  });

  it.each([
    "qa+admin@qa.example.com",
    "qa@qa.example.com",
    "qa-20261108kqzt-owner@qa.example.com",
    "qa+20261108kqzt-owner@example.com",
    "qa+20261108kqzt-owner@x.qa.example.com",
    "qa+2026110kqzt-owner@qa.example.com",
  ])("never serves %s", (email) => {
    expect(isQaRunAddress(email, "qa.example.com")).toBe(false);
  });
});

describe("qaOutboxCutoff", () => {
  it("is 24 hours before now", () => {
    const now = new Date("2026-11-08T12:00:00Z");
    expect(qaOutboxCutoff(now).getTime()).toBe(
      now.getTime() - QA_OUTBOX_RETENTION_MS
    );
    expect(qaOutboxCutoff(now).toISOString()).toBe("2026-11-07T12:00:00.000Z");
  });
});

describe("renderedHeaders", () => {
  it("has the envelope headers, a Message-ID on the sender's domain and the message's own headers", () => {
    expect(
      renderedHeaders({
        from: { email: "starter@flooper.me", name: 'Cloudflare "Starter"' },
        to: { email: "qa+20261108kqzt-a@qa.flooper.me" },
        subject: "Verify your email",
        id: "abc",
        date: new Date("2026-11-08T12:00:00Z"),
        headers: {
          "List-Unsubscribe": "<https://starter.flooper.me/api/u?t=x>",
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      })
    ).toEqual({
      from: '"Cloudflare Starter" <starter@flooper.me>',
      to: "qa+20261108kqzt-a@qa.flooper.me",
      subject: "Verify your email",
      date: "Sun, 08 Nov 2026 12:00:00 GMT",
      "message-id": "<abc@flooper.me>",
      "mime-version": "1.0",
      "list-unsubscribe": "<https://starter.flooper.me/api/u?t=x>",
      "list-unsubscribe-post": "List-Unsubscribe=One-Click",
    });
  });
});
