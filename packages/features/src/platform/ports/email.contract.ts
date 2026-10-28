/**
 * The Email contract: every adapter's `*.contract.test.ts` runs this suite against it.
 * Test support only (not exported from the barrel, not bundled).
 */
import { describe, expect, it } from "vitest";

import type { EmailService, SendEmailInput } from "./email";

export interface EmailHarness {
  readonly email: EmailService;
  /** Whether the adapter delivers mail (false for noop). */
  readonly delivers: boolean;
  /** What reached the underlying service, in order (the noop adapter has nothing). */
  readonly delivered: () => readonly SendEmailInput[];
}

export function contractMessage(
  overrides: Partial<SendEmailInput> = {}
): SendEmailInput {
  return {
    to: { email: "grace@example.test", name: "Grace Hopper" },
    subject: "Ada joined Analytical Engines",
    text: "Ada Lovelace joined Analytical Engines as a member.",
    html: "<p>Ada Lovelace joined <strong>Analytical Engines</strong> as a member.</p>",
    headers: {
      "List-Unsubscribe":
        "<https://app.example.test/api/notifications/unsubscribe?t=abc>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    ...overrides,
  };
}

const INVALID: readonly [string, Partial<SendEmailInput>][] = [
  [
    "a header value with a line break",
    { headers: { "X-Note": "a\r\nBcc: x@evil.test" } },
  ],
  ["a header name with a colon", { headers: { "X:Note": "a" } }],
  ["a header the adapter sets", { headers: { From: "mallory@evil.test" } }],
  ["a subject with a line break", { subject: "Hi\nBcc: x@evil.test" }],
  ["no recipient", { to: { email: " " } }],
];

export function describeEmailContract(
  name: string,
  makeHarness: () => EmailHarness
): void {
  describe(`${name} satisfies the Email contract`, () => {
    it("says whether it delivers mail", () => {
      const { email, delivers } = makeHarness();
      expect(email.enabled).toBe(delivers);
    });

    it("sends the message with its headers", async () => {
      const { email, delivers, delivered } = makeHarness();
      await email.send(contractMessage());
      expect(delivered()).toEqual(delivers ? [contractMessage()] : []);
    });

    it("sends a message without extra headers", async () => {
      const { email, delivers, delivered } = makeHarness();
      await email.send(contractMessage({ headers: undefined }));
      expect(delivered().length).toBe(delivers ? 1 : 0);
    });

    it.each(INVALID)("rejects %s before sending", async (_, overrides) => {
      const { email, delivered } = makeHarness();
      await expect(
        email.send(contractMessage(overrides))
      ).rejects.toBeInstanceOf(TypeError);
      expect(delivered()).toEqual([]);
    });
  });
}
