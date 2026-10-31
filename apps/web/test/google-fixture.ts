import { importJWK, SignJWT } from "jose";
import { GOOGLE_TEST_KEY } from "./google-fixture-key";
export const GOOGLE_TEST_CLIENT_ID =
  "security-fixture.apps.googleusercontent.com";
export const GOOGLE_TEST_CLIENT_SECRET = "synthetic-google-client-secret";

/** Synthetic Google JWTs exercise the real issuer/audience/signature/nonce verifier. */
export async function googleIdToken(
  email: string,
  nonce?: string,
  audience = GOOGLE_TEST_CLIENT_ID
) {
  return new SignJWT({
    email,
    email_verified: true,
    name: "Synthetic Google user",
    ...(nonce ? { nonce } : {}),
  })
    .setProtectedHeader({ alg: "RS256", kid: GOOGLE_TEST_KEY.kid })
    .setSubject(email)
    .setIssuer("https://accounts.google.com")
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(await importJWK(GOOGLE_TEST_KEY, "RS256"));
}

/** Only these fixed provider endpoints are simulated; no test reaches Google. */
export async function googleFixture(
  request: Request
): Promise<Response | null> {
  if (
    request.url === "https://www.googleapis.com/oauth2/v3/certs" &&
    request.method === "GET"
  ) {
    return Response.json({
      keys: [
        {
          kty: GOOGLE_TEST_KEY.kty,
          n: GOOGLE_TEST_KEY.n,
          e: GOOGLE_TEST_KEY.e,
          alg: "RS256",
          kid: GOOGLE_TEST_KEY.kid,
          use: "sig",
        },
      ],
    });
  }
  if (
    request.url === "https://oauth2.googleapis.com/token" &&
    request.method === "POST"
  ) {
    const form = new URLSearchParams(await request.text());
    const code = form.get("code") ?? "";
    if (
      form.get("client_id") !== GOOGLE_TEST_CLIENT_ID ||
      form.get("client_secret") !== GOOGLE_TEST_CLIENT_SECRET ||
      !code.startsWith("security-fixture:")
    )
      return Response.json({ error: "invalid_grant" }, { status: 400 });
    const input = JSON.parse(code.slice("security-fixture:".length)) as {
      email: string;
      nonce?: string;
    };
    if (!input.email.endsWith("@example.test"))
      return Response.json({ error: "invalid_grant" }, { status: 400 });
    return Response.json({
      token_type: "Bearer",
      access_token: "synthetic-google-access-token",
      expires_in: 300,
      scope: "openid email profile",
      id_token: await googleIdToken(input.email, input.nonce),
    });
  }
  return null;
}
