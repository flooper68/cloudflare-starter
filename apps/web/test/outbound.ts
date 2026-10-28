/**
 * Outbound fetches of the Worker under test (Miniflare `outboundService`). No test
 * reaches the network: Turnstile Siteverify is answered here the way Cloudflare answers
 * for its published test secret keys, everything else fails.
 * https://developers.cloudflare.com/turnstile/troubleshooting/testing/
 */
export const TURNSTILE_PASS_SECRET = "1x0000000000000000000000000000000AA";
export const TURNSTILE_FAIL_SECRET = "2x0000000000000000000000000000000AA";
export const TURNSTILE_DUMMY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function outbound(request: Request): Promise<Response> {
  if (request.url !== SITEVERIFY || request.method !== "POST") {
    return new Response(
      `No network in tests: ${request.method} ${request.url}`,
      {
        status: 502,
      }
    );
  }
  const form = new URLSearchParams(await request.text());
  const secret = form.get("secret") ?? "";
  if (!/^[123]x0{31}AA$/.test(secret)) {
    return Response.json({
      success: false,
      "error-codes": ["invalid-input-secret"],
    });
  }
  // Test secrets accept only the dummy token; 2x always fails, 3x reports a reused token.
  const passes =
    secret === TURNSTILE_PASS_SECRET &&
    form.get("response") === TURNSTILE_DUMMY_TOKEN;
  return Response.json({
    success: passes,
    "error-codes": passes
      ? []
      : [
          secret.startsWith("3x")
            ? "timeout-or-duplicate"
            : "invalid-input-response",
        ],
  });
}
