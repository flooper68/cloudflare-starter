import { describe, expect, it } from "vitest";

import { fixedClock, testDb } from "../../test/fixtures";
import { message, OWNER, storeAt } from "../../test/qa-outbox-fixtures";
import { listQaMail } from "./list-qa-mail";

describe("storeQaMail", () => {
  it("stores the fully rendered message with every header, the unsubscribe ones included", async () => {
    const at = "2026-11-08T12:00:00.000Z";
    const { id } = await storeAt(
      at,
      message(OWNER.toUpperCase(), "Member joined", {
        "List-Unsubscribe":
          "<https://starter.flooper.me/api/notifications/unsubscribe?t=x>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      })
    );
    const [stored] = await listQaMail(
      { db: testDb(), clock: fixedClock(at) },
      { to: OWNER, since: null, subject: null }
    );
    expect(stored).toMatchObject({
      id,
      to: OWNER,
      from: "starter@flooper.me",
      subject: "Member joined",
      receivedAt: at,
    });
    expect(stored?.text).toContain("/api/auth/verify-email?token=x");
    expect(stored?.html).toContain('href="https://starter.flooper.me');
    expect(stored?.headers).toMatchObject({
      from: '"Cloudflare Starter" <starter@flooper.me>',
      to: OWNER.toUpperCase(),
      subject: "Member joined",
      "message-id": `<${id}@flooper.me>`,
      "list-unsubscribe":
        "<https://starter.flooper.me/api/notifications/unsubscribe?t=x>",
      "list-unsubscribe-post": "List-Unsubscribe=One-Click",
    });
  });
});
