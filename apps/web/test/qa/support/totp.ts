/**
 * Authenticator codes from the setup secret, as an authenticator app would compute them.
 * No new dependency: `@better-auth/utils` (already a devDependency of apps/web, the
 * library Better Auth itself verifies codes with, pinned with it) has RFC 6238 TOTP.
 */
import { base32 } from "@better-auth/utils/base32";
import { createOTP } from "@better-auth/utils/otp";

/** The current six-digit code of an `otpauth://totp/…?secret=…` setup URI. */
export function totpCode(totpURI: string): Promise<string> {
  const secret = new URL(totpURI).searchParams.get("secret");
  if (!secret) throw new Error("the setup URI has no secret");
  return createOTP(base32.decode(secret)).totp();
}

const used = new Set<string>();

/**
 * A code no earlier step of this worker used: the server refuses a code twice (replay
 * protection), so after one sign-in the next waits for the authenticator's next 30-second
 * step, as a person would.
 */
export async function freshTotpCode(totpURI: string): Promise<string> {
  for (;;) {
    const code = await totpCode(totpURI);
    if (!used.has(`${totpURI} ${code}`)) {
      used.add(`${totpURI} ${code}`);
      return code;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
}
