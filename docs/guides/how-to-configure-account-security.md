# Account security

Use this guide to choose enrollment policy, set up authenticators/passkeys, recover access or change the auth integration.

`bun run setup:auth --env <env> --dry-run` previews choices. The real setup writes these nonsecret vars into each environment; deploy only after review. No deployed choice is shipped. Local development copies `.dev.vars.example`.

| Setting                          | Values                                               | Effect                                                                                                                                                                           |
| -------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TWO_FACTOR`                     | `off`, `optional`, `required-for-admins`, `required` | Off closes factor endpoints. Optional allows enrollment; enrolled people always complete a factor. The required modes gate application access until enrollment and verification. |
| `TWO_FACTOR_EMAIL_OTP`           | `on`, `off`                                          | Enables email recovery codes after authenticator enrollment. Needs configured email; no email-only enrollment shortcut.                                                          |
| `TWO_FACTOR_TRUSTED_DEVICE_DAYS` | Integer 0–30                                         | Zero disables remembered devices and invalidates presented trust records. Positive values use Better Auth's signed, server-backed, rotating trust cookie.                        |
| `PASSKEYS`                       | `on`, `off`                                          | Enables native WebAuthn registration and sign-in for this origin.                                                                                                                |

`bun run doctor` checks choices. Passkey RP ID is the hostname of `APP_URL`; origin is exactly `APP_URL`. A production hostname change affects existing credentials and must be planned. Local browser testing uses localhost.

## User flows

Settings → Security contains authenticator enrollment (QR and manual-key alternative), recovery codes, regeneration, optional-factor removal and a named passkey list. Password accounts confirm their current password; social-only accounts use the current authenticated session. Required enrollment redirects to `/two-factor`, which exposes only setup/challenge/recovery access until complete. The native six-digit code, backup code or optional emailed code completes sign-in. Email recovery is available only after a verified authenticator enrollment, never as an enrollment shortcut. An enrolled account may re-read its TOTP setup key only after a fresh explicit factor verification. Recovery codes are encrypted at rest, returned only to the browser that enrolls/regenerates them, and usable once.

Passkeys are primary credentials. Better Auth 1.7.14's plugin does not require authenticator user verification, so this application does not claim that a passkey alone proves multiple factors: enrolled users still complete their configured second factor after passkey or Google sign-in. A remembered device may satisfy normal application access; destructive admin actions require a fresh explicit code verification within fifteen minutes. `STEP_UP_REQUIRED` opens `/two-factor?stepUp=1&next=…` even when normal access is already allowed, returns to the interrupted page after success, and leaves the action for the administrator to confirm again.

An administrator may reset another person's second factor from their user-detail page. This requires a browser and the destructive-admin gate. Self-reset and resetting the last active administrator are refused. Reset removes the authenticator/recovery codes, remembered-device records, sessions and OAuth tokens, records an audit event, and sends a security notification. Passkeys remain primary sign-in credentials; the person enrolls a new authenticator if policy requires it.

## Assurance and MCP

Session `amr` (space-separated RFC 8176 method identifiers) and `secondFactorAt` are server-owned fields with `input: false`. A final auth plugin runs after native factor hooks: a password accepted before its challenge is not a sign-in and is never audited as one. Gates read current enrollment and the exact user-bound, unexpired D1 session, so neither enrollment alone nor another session can grant assurance.

OAuth access tokens carry `starter_session_id` derived from the authorization/refresh grant's session ID. The resource server rechecks that exact session, not the user's newest login. An expired/revoked grant session requires reconnecting the client. Every user-bound token needs that claim, including when two-factor authentication is optional or off. Minting or refreshing a user token without a live grant session returns `invalid_grant`; previously issued tokens without the claim require reconnecting. Factor management and admin recovery stay in the browser; `get_security_status` is the safe MCP status tool and returns no credentials, TOTP keys or backup codes.

Native sign-in challenges and signed-in step-up share an account budget: ten failed verifications lock verification for fifteen minutes. Additional database-backed endpoint limits are ten factor requests/minute, three email-code sends/minute, twenty passkey requests/minute. They complement the existing auth IP edge limit.

## Implementation and validation

`server/auth-security.ts` adapts the pinned native plugin hooks; review their ordering/response semantics on Better Auth upgrades. The pure policy and safe state reader live under `packages/features/src/accounts`. Regenerate auth tables from `scripts/auth-schema.config.ts` after changing plugins/session fields, then regenerate the starter's single migration per the D1 guide. A deployed downstream app uses additive migrations.

Tests cover policy choices, required enrollment, current-session evidence, factor removal, recovery replay, API bypass, administrative recovery and native ceremonies. Review regressions use signed stale cookies, actual OAuth PKCE/offline refresh/revocation, and synthetic Google tokens/callbacks verified with the real provider signature/issuer/audience/nonce logic. The only Google key is a public test fixture; no test uses real Google credentials or reaches Google. `test/e2e/security.spec.ts` enrolls a real TOTP and uses a Chromium virtual WebAuthn authenticator; it uses the same test-only Turnstile simulator as other journeys. This proves browser/runtime wiring, not a real phone or hardware key. Capture both themes and redact setup keys/recovery codes from shareable evidence.
