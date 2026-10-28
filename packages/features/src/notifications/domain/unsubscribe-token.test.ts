import { describe, expect, it } from "vitest";

import {
  deriveUnsubscribeKey,
  signUnsubscribeToken,
  verifyUnsubscribeToken,
} from "./unsubscribe-token";

const SECRET = "test-secret-for-unsubscribe-links-0123456789";
const target = { userId: "user-grace", type: "workspaces.member-joined" };

describe("unsubscribe tokens", () => {
  it("verify to the user and type they were signed for", async () => {
    const key = await deriveUnsubscribeKey(SECRET);
    const token = await signUnsubscribeToken(key, target);
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(await verifyUnsubscribeToken(key, token)).toEqual(target);
  });

  it("are deterministic for one key (no expiry, no nonce)", async () => {
    const key = await deriveUnsubscribeKey(SECRET);
    expect(await signUnsubscribeToken(key, target)).toBe(
      await signUnsubscribeToken(await deriveUnsubscribeKey(SECRET), target)
    );
  });

  it("refuse a tampered payload", async () => {
    const key = await deriveUnsubscribeKey(SECRET);
    const [, signature] = (await signUnsubscribeToken(key, target)).split(".");
    const forged = btoa(JSON.stringify({ u: "user-ada", t: target.type }))
      .replaceAll("=", "")
      .replaceAll("+", "-")
      .replaceAll("/", "_");
    expect(await verifyUnsubscribeToken(key, `${forged}.${signature}`)).toBe(
      null
    );
  });

  it("refuse a tampered signature", async () => {
    const key = await deriveUnsubscribeKey(SECRET);
    const token = await signUnsubscribeToken(key, target);
    const flipped = `${token.slice(0, -2)}${token.endsWith("A") ? "B" : "A"}${token.slice(-1)}`;
    expect(await verifyUnsubscribeToken(key, flipped)).toBe(null);
  });

  it("refuse a token signed with another secret (rotation invalidates links)", async () => {
    const token = await signUnsubscribeToken(
      await deriveUnsubscribeKey(`${SECRET}-old`),
      target
    );
    expect(
      await verifyUnsubscribeToken(await deriveUnsubscribeKey(SECRET), token)
    ).toBe(null);
  });

  it.each(["", "abc", "a.b.c", "!!.??", `${"a".repeat(1001)}.b`])(
    "refuse the malformed token %j",
    async (token) => {
      const key = await deriveUnsubscribeKey(SECRET);
      expect(await verifyUnsubscribeToken(key, token)).toBe(null);
    }
  );

  it("refuse a short secret", async () => {
    await expect(deriveUnsubscribeKey("short")).rejects.toThrow(/32/);
  });
});
