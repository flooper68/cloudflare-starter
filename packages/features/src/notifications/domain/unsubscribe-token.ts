import { z } from "zod";

/**
 * Unsubscribe links (RFC 8058 one-click): `<payload>.<signature>`, both base64url. The
 * payload names the user and the notification type (or UNSUBSCRIBE_ALL for a digest);
 * the signature is HMAC-SHA256 with a key derived from BETTER_AUTH_SECRET by HKDF (info
 * UNSUBSCRIBE_KEY_INFO), so a link cannot be forged or edited. Links do not expire; rotating
 * BETTER_AUTH_SECRET invalidates every link already sent.
 */

/** HKDF `info`: keeps this key apart from every other key derived from the same secret. */
export const UNSUBSCRIBE_KEY_INFO = "notifications.unsubscribe";

/** The type a digest's link unsubscribes from: every notification mail that may be turned off. */
export const UNSUBSCRIBE_ALL = "*";

export interface UnsubscribeTarget {
  readonly userId: string;
  readonly type: string;
}

const payloadSchema = z
  .object({ u: z.string().min(1).max(200), t: z.string().min(1).max(100) })
  .strict();

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) return null;
  try {
    const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/"));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

/** The HMAC key for unsubscribe links, derived from the app secret with HKDF-SHA256. */
export async function deriveUnsubscribeKey(secret: string): Promise<CryptoKey> {
  if (secret.length < 32) {
    throw new Error(
      "The unsubscribe key needs a secret of at least 32 characters"
    );
  }
  const base = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    "HKDF",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0),
      info: encoder.encode(UNSUBSCRIBE_KEY_INFO),
    },
    base,
    { name: "HMAC", hash: "SHA-256", length: 256 },
    false,
    ["sign", "verify"]
  );
}

/** A token for the link in one mail. */
export async function signUnsubscribeToken(
  key: CryptoKey,
  target: UnsubscribeTarget
): Promise<string> {
  const payload = toBase64Url(
    encoder.encode(JSON.stringify({ u: target.userId, t: target.type }))
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload)
  );
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

/** The user and type of a token, or null when it is malformed or its signature is wrong. */
export async function verifyUnsubscribeToken(
  key: CryptoKey,
  token: string
): Promise<UnsubscribeTarget | null> {
  if (token.length > 1000) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  const signatureBytes = fromBase64Url(signature);
  if (!signatureBytes) return null;
  // Constant-time comparison, inside Web Crypto.
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    encoder.encode(payload)
  );
  if (!valid) return null;
  const bytes = fromBase64Url(payload);
  if (!bytes) return null;
  try {
    const parsed = payloadSchema.safeParse(
      JSON.parse(new TextDecoder().decode(bytes))
    );
    return parsed.success
      ? { userId: parsed.data.u, type: parsed.data.t }
      : null;
  } catch {
    return null;
  }
}
