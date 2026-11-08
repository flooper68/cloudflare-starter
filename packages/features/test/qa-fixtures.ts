// Fixtures of the QA outbox integration tests (packages/features/src/qa-outbox).

import type { SendEmailInput } from "../src/platform";
import { storeQaMail } from "../src/qa/store-qa-mail";
import { fixedClock, sequentialIds, testDb } from "./fixtures";

export const FROM = { email: "starter@flooper.me", name: "Cloudflare Starter" };
export const OWNER = "qa+20261108kqzt-owner@qa.flooper.me";

export function message(
  to: string,
  subject = "Verify your email",
  headers?: Readonly<Record<string, string>>
): SendEmailInput {
  return {
    to: { email: to },
    subject,
    text: `Hello ${to}: https://starter.flooper.me/api/auth/verify-email?token=x`,
    html: `<p><a href="https://starter.flooper.me/api/auth/verify-email?token=x">Verify</a></p>`,
    ...(headers ? { headers } : {}),
  };
}

const ids = sequentialIds("00000000-0000-4000-9000-");

/** Stores one message at `at` (ISO). */
export function storeAt(at: string, input: SendEmailInput) {
  return storeQaMail(
    { db: testDb(), clock: fixedClock(at), ids },
    { from: FROM, message: input }
  );
}
