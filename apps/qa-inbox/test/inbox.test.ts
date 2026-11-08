import { createScheduledController } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleApi } from "../src/api";
import { timingSafeEqual } from "../src/auth";
import { RETENTION_MS } from "../src/env";
import worker from "../src/index";
import { receiveEmail } from "../src/receive";
import type { InboxMessage } from "../src/store";

const TOKEN = env.QA_INBOX_TOKEN;
const BASE = "https://qa-inbox.example.workers.dev";
const OWNER = "qa-20261108abcd-owner@qa.flooper.me";

/** A notification-like mail as the app sends it, with the RFC 8058 headers. */
function mime(input: {
  readonly to: string;
  readonly subject: string;
  readonly text?: string;
}): string {
  return [
    "From: Cloudflare Starter <starter@flooper.me>",
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    "Date: Sun, 08 Nov 2026 12:00:00 +0000",
    "Message-ID: <abc@flooper.me>",
    "List-Unsubscribe: <https://starter.flooper.me/api/notifications/unsubscribe?token=t>",
    "List-Unsubscribe-Post: List-Unsubscribe=One-Click",
    "MIME-Version: 1.0",
    'Content-Type: multipart/alternative; boundary="b"',
    "",
    "--b",
    "Content-Type: text/plain; charset=utf-8",
    "",
    input.text ??
      "Verify: https://starter.flooper.me/api/auth/verify-email?token=x",
    "--b",
    "Content-Type: text/html; charset=utf-8",
    "",
    '<p><a href="https://starter.flooper.me/api/auth/verify-email?token=x">Verify</a></p>',
    "--b--",
    "",
  ].join("\r\n");
}

/** A ForwardableEmailMessage like Email Routing hands the Worker. */
function incoming(to: string, raw: string, envelopeFrom = "bounce@flooper.me") {
  const bytes = new TextEncoder().encode(raw);
  return {
    from: envelopeFrom,
    to,
    raw: new Blob([bytes]).stream(),
    rawSize: bytes.byteLength,
    headers: new Headers(),
    setReject: vi.fn(),
    forward: vi.fn(),
    reply: vi.fn(),
  } as unknown as ForwardableEmailMessage & {
    setReject: ReturnType<typeof vi.fn>;
    forward: ReturnType<typeof vi.fn>;
    reply: ReturnType<typeof vi.fn>;
  };
}

function api(
  method: string,
  path: string,
  token: string | null = TOKEN,
  headers: Record<string, string> = {}
): Promise<Response> {
  return handleApi(
    new Request(`${BASE}${path}`, {
      method,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    }),
    env
  );
}

async function messages(query: string): Promise<InboxMessage[]> {
  const response = await api("GET", `/messages?${query}`);
  expect(response.status).toBe(200);
  return ((await response.json()) as { messages: InboxMessage[] }).messages;
}

beforeEach(async () => {
  await env.INBOX.exec("DELETE FROM messages");
});

describe("receiving", () => {
  it("stores a mail to the QA domain with its parts and headers, and never forwards it", async () => {
    const message = incoming(
      OWNER.toUpperCase(),
      mime({ to: OWNER, subject: "Verify your email" })
    );
    await worker.email(message, env);
    expect(message.setReject).not.toHaveBeenCalled();
    expect(message.forward).not.toHaveBeenCalled();
    expect(message.reply).not.toHaveBeenCalled();
    const [stored] = await messages(`to=${encodeURIComponent(OWNER)}`);
    expect(stored).toMatchObject({
      to: OWNER,
      from: "starter@flooper.me",
      subject: "Verify your email",
      date: "2026-11-08T12:00:00.000Z",
    });
    expect(stored?.text).toContain("/api/auth/verify-email?token=x");
    expect(stored?.html).toContain('href="https://starter.flooper.me');
    expect(stored?.headers["list-unsubscribe"]).toBe(
      "<https://starter.flooper.me/api/notifications/unsubscribe?token=t>"
    );
    expect(stored?.headers["list-unsubscribe-post"]).toBe(
      "List-Unsubscribe=One-Click"
    );
  });

  it.each([
    ["another domain", "someone@flooper.me"],
    ["a subdomain of the QA domain", "a@x.qa.flooper.me"],
  ])("rejects mail to %s and stores nothing", async (_, to) => {
    const message = incoming(to, mime({ to, subject: "Hello" }));
    await receiveEmail(message, env);
    expect(message.setReject).toHaveBeenCalledOnce();
    expect(message.forward).not.toHaveBeenCalled();
    const { results } = await env.INBOX.prepare(
      "SELECT count(*) AS n FROM messages"
    ).all<{ n: number }>();
    expect(results[0]?.n).toBe(0);
  });

  it("rejects a mail over the size limit", async () => {
    const message = incoming(OWNER, mime({ to: OWNER, subject: "Big" }));
    Object.defineProperty(message, "rawSize", { value: 2 * 1024 * 1024 });
    await receiveEmail(message, env);
    expect(message.setReject).toHaveBeenCalledWith("Message too large.");
  });

  it("falls back to the envelope sender when the mail has no From", async () => {
    const raw = mime({ to: OWNER, subject: "No from" }).replace(
      /^From: .*\r\n/,
      ""
    );
    await receiveEmail(incoming(OWNER, raw, "envelope@flooper.me"), env);
    const [stored] = await messages(`to=${OWNER}`);
    expect(stored?.from).toBe("envelope@flooper.me");
  });
});

describe("the API", () => {
  async function deliver(to: string, subject: string, at: number) {
    await receiveEmail(incoming(to, mime({ to, subject })), env, () => at);
  }

  it("refuses requests without the bearer token, with a wrong one, or with another scheme", async () => {
    for (const response of [
      await api("GET", `/messages?to=${OWNER}`, null),
      await api("GET", `/messages?to=${OWNER}`, `${TOKEN}x`),
      await api("GET", `/messages?to=${OWNER}`, null, {
        authorization: `Basic ${TOKEN}`,
      }),
    ]) {
      expect(response.status).toBe(401);
      expect(response.headers.get("www-authenticate")).toContain("Bearer");
    }
  });

  it("refuses everyone when QA_INBOX_TOKEN is missing or too short", async () => {
    for (const QA_INBOX_TOKEN of [undefined, "", "short"]) {
      const response = await handleApi(
        new Request(`${BASE}/messages?to=${OWNER}`, {
          headers: { authorization: `Bearer ${QA_INBOX_TOKEN}` },
        }),
        { ...env, QA_INBOX_TOKEN }
      );
      expect(response.status).toBe(401);
    }
  });

  it("compares tokens in constant time", () => {
    expect(timingSafeEqual(TOKEN, TOKEN)).toBe(true);
    expect(timingSafeEqual(TOKEN.slice(0, -1), TOKEN)).toBe(false);
    expect(timingSafeEqual(`${TOKEN}x`, TOKEN)).toBe(false);
    expect(timingSafeEqual("", "")).toBe(false);
  });

  it("serves no other route, no other method and no CORS", async () => {
    expect((await api("GET", "/")).status).toBe(404);
    expect((await api("GET", "/messages/1")).status).toBe(404);
    const post = await api("POST", `/messages?to=${OWNER}`);
    expect(post.status).toBe(405);
    expect(post.headers.get("allow")).toBe("GET, DELETE");
    const preflight = await api("OPTIONS", `/messages?to=${OWNER}`, null, {
      origin: "https://evil.example",
      "access-control-request-method": "GET",
    });
    expect(preflight.status).toBe(401);
    const allowed = await api("GET", `/messages?to=${OWNER}`, TOKEN, {
      origin: "https://evil.example",
    });
    for (const response of [preflight, allowed]) {
      expect(
        [...response.headers.keys()].filter((name) =>
          name.startsWith("access-control-")
        )
      ).toEqual([]);
    }
  });

  it("needs a QA run address in to", async () => {
    await receiveEmail(
      incoming(
        "qa-admin@qa.flooper.me",
        mime({ to: "qa-admin@qa.flooper.me", subject: "Reset your password" })
      ),
      env
    );
    for (const query of [
      "",
      "to=",
      "to=someone%40example.com",
      // In the domain but not a run address: the QA admin's mail is never served.
      "to=qa-admin%40qa.flooper.me",
    ]) {
      expect((await api("GET", `/messages?${query}`)).status).toBe(400);
      expect((await api("DELETE", `/messages?${query}`)).status).toBe(400);
    }
  });

  it("filters by recipient, since and subject, newest first", async () => {
    const t0 = Date.now() - 60_000;
    await deliver(OWNER, "Verify your email", t0);
    await deliver(OWNER, "Reset your password", t0 + 1_000);
    await deliver(OWNER, "Verify your email", t0 + 2_000);
    await deliver(
      "qa-20261108abcd-other@qa.flooper.me",
      "Verify your email",
      t0 + 3_000
    );

    const all = await messages(`to=${OWNER}`);
    expect(all.map((message) => message.subject)).toEqual([
      "Verify your email",
      "Reset your password",
      "Verify your email",
    ]);
    expect(all[0]?.receivedAt).toBe(new Date(t0 + 2_000).toISOString());

    const verify = await messages(`to=${OWNER}&subject=verify`);
    expect(verify).toHaveLength(2);

    const since = new Date(t0 + 500).toISOString();
    const recent = await messages(
      `to=${OWNER}&since=${encodeURIComponent(since)}`
    );
    expect(recent).toHaveLength(2);

    expect(
      (await api("GET", `/messages?to=${OWNER}&since=yesterday`)).status
    ).toBe(400);
  });

  it("never returns messages older than 24 hours", async () => {
    await deliver(OWNER, "Old", Date.now() - RETENTION_MS - 1_000);
    await deliver(OWNER, "New", Date.now());
    expect(
      (await messages(`to=${OWNER}&since=1970-01-01T00:00:00Z`)).map(
        (m) => m.subject
      )
    ).toEqual(["New"]);
  });

  it("clears one recipient's messages", async () => {
    await deliver(OWNER, "One", Date.now());
    await deliver("qa-20261108abcd-other@qa.flooper.me", "Two", Date.now());
    const response = await api("DELETE", `/messages?to=${OWNER}`);
    expect(await response.json()).toEqual({ deleted: 1 });
    expect(await messages(`to=${OWNER}`)).toEqual([]);
    expect(
      await messages("to=qa-20261108abcd-other@qa.flooper.me")
    ).toHaveLength(1);
  });
});

describe("retention", () => {
  it("the cron deletes messages older than 24 hours", async () => {
    const old = incoming(OWNER, mime({ to: OWNER, subject: "Old" }));
    await receiveEmail(old, env, () => Date.now() - RETENTION_MS - 60_000);
    const fresh = incoming(OWNER, mime({ to: OWNER, subject: "Fresh" }));
    await receiveEmail(fresh, env);
    await worker.scheduled(
      createScheduledController({ cron: "41 * * * *" }),
      env
    );
    const { results } = await env.INBOX.prepare(
      "SELECT subject FROM messages"
    ).all<{ subject: string }>();
    expect(results.map((row) => row.subject)).toEqual(["Fresh"]);
  });
});
