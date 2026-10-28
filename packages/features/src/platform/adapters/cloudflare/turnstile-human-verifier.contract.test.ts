import { describe, expect, it } from "vitest";

import { describeHumanVerifierContract } from "../../ports/human-verifier.contract";
import {
  createTurnstileVerifier,
  SITEVERIFY_URL,
} from "./turnstile-human-verifier";

// Cloudflare's published test keys (developers.cloudflare.com/turnstile/troubleshooting/testing/).
const ALWAYS_PASS_SECRET = "1x0000000000000000000000000000000AA";
const ALWAYS_FAIL_SECRET = "2x0000000000000000000000000000000AA";
const DUMMY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

const ids = { uuid: () => "8f14e45f-ceea-467a-9a36-dedd4bea2543" };

/** Answers Siteverify the way Cloudflare does for its test secret keys; no network. */
function fakeSiteverify(calls: URLSearchParams[] = []): typeof fetch {
  return async (url, init) => {
    expect(String(url)).toBe(SITEVERIFY_URL);
    const form = new URLSearchParams(String(init?.body));
    calls.push(form);
    const secret = form.get("secret");
    const passes =
      secret === ALWAYS_PASS_SECRET && form.get("response") === DUMMY_TOKEN;
    return Response.json(
      secret?.match(/^[123]x0+AA$/)
        ? {
            success: passes,
            "error-codes": passes ? [] : ["invalid-input-response"],
          }
        : { success: false, "error-codes": ["invalid-input-secret"] }
    );
  };
}

describeHumanVerifierContract("cloudflare turnstile", () => ({
  verifier: createTurnstileVerifier({
    secretKey: ALWAYS_PASS_SECRET,
    fetch: fakeSiteverify(),
    ids,
  }),
  passToken: DUMMY_TOKEN,
  failToken: "not-a-turnstile-token",
  enforces: true,
}));

const input = {
  token: DUMMY_TOKEN,
  remoteIp: "203.0.113.7",
  action: "sign-up",
};

describe("turnstile verifier", () => {
  it("sends the secret, token, client IP and an idempotency key", async () => {
    const calls: URLSearchParams[] = [];
    await createTurnstileVerifier({
      secretKey: ALWAYS_PASS_SECRET,
      fetch: fakeSiteverify(calls),
      ids,
    }).verify(input);
    expect(Object.fromEntries(calls[0] ?? [])).toEqual({
      secret: ALWAYS_PASS_SECRET,
      response: DUMMY_TOKEN,
      remoteip: "203.0.113.7",
      idempotency_key: ids.uuid(),
    });
  });

  it("refuses everything with the always-fail secret", async () => {
    const verifier = createTurnstileVerifier({
      secretKey: ALWAYS_FAIL_SECRET,
      fetch: fakeSiteverify(),
      ids,
    });
    expect(await verifier.verify(input)).toEqual({
      ok: false,
      reason: "rejected",
    });
  });

  it("refuses a token issued for another action", async () => {
    const verifier = createTurnstileVerifier({
      secretKey: "real-secret",
      fetch: async () => Response.json({ success: true, action: "sign-in" }),
      ids,
    });
    expect(await verifier.verify(input)).toEqual({
      ok: false,
      reason: "rejected",
    });
  });

  it("retries once with the same idempotency key, then fails closed", async () => {
    const calls: URLSearchParams[] = [];
    const verifier = createTurnstileVerifier({
      secretKey: ALWAYS_PASS_SECRET,
      fetch: async (_url, init) => {
        calls.push(new URLSearchParams(String(init?.body)));
        throw new TypeError("network down");
      },
      ids,
    });
    expect(await verifier.verify(input)).toEqual({
      ok: false,
      reason: "unavailable",
    });
    expect(calls).toHaveLength(2);
    expect(calls[0]?.get("idempotency_key")).toBe(
      calls[1]?.get("idempotency_key")
    );
  });

  it("passes when the retry answers after a 5xx", async () => {
    let call = 0;
    const verifier = createTurnstileVerifier({
      secretKey: ALWAYS_PASS_SECRET,
      fetch: async (url, init) => {
        call++;
        return call === 1
          ? new Response("bad gateway", { status: 502 })
          : fakeSiteverify()(url, init);
      },
      ids,
    });
    expect(await verifier.verify(input)).toEqual({ ok: true });
  });

  it("gives up on a Siteverify that does not answer within the timeout", async () => {
    const verifier = createTurnstileVerifier({
      secretKey: ALWAYS_PASS_SECRET,
      timeoutMs: 20,
      fetch: (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(init.signal?.reason)
          );
        }),
      ids,
    });
    expect(await verifier.verify(input)).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  it("reports a wrong secret as unavailable, not as the visitor's fault", async () => {
    const verifier = createTurnstileVerifier({
      secretKey: "wrong",
      fetch: fakeSiteverify(),
      ids,
    });
    expect(await verifier.verify(input)).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  it("rejects an oversized token without calling Siteverify", async () => {
    const calls: URLSearchParams[] = [];
    const verifier = createTurnstileVerifier({
      secretKey: ALWAYS_PASS_SECRET,
      fetch: fakeSiteverify(calls),
      ids,
    });
    expect(
      await verifier.verify({ ...input, token: "x".repeat(2049) })
    ).toEqual({ ok: false, reason: "rejected" });
    expect(calls).toEqual([]);
  });
});
