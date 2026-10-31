/**
 * Auth links (password reset, email verification, invitations) when email is off. The
 * links carry single-use tokens, so they are logged only in local development
 * (APP_ENV=local, set by .dev.vars). A deployed environment never logs them: it refuses
 * the request with an error saying email is not configured.
 */
import type { Logger } from "@cloudflare-starter/features";
import { APIError } from "better-auth/api";

/** The only environment whose logs may contain auth links. */
export const LOCAL_ENVIRONMENT = "local";

export const EMAIL_NOT_CONFIGURED_MESSAGE =
  "Email is not configured for this environment, so this link cannot be sent. Set EMAIL_FROM and the EMAIL binding (docs/guides/how-to-setup-email.md).";

/** Better Auth endpoints that only exist to send a link by email. */
export const EMAIL_LINK_PATHS: readonly string[] = [
  "/request-password-reset",
  "/send-verification-email",
  "/change-email",
];

export function mayLogAuthLinks(environment: string): boolean {
  return environment === LOCAL_ENVIRONMENT;
}

/** The refusal a deployed environment without email gives instead of sending a link. */
export function emailNotConfiguredError(): APIError {
  return new APIError("PRECONDITION_FAILED", {
    message: EMAIL_NOT_CONFIGURED_MESSAGE,
    code: "EMAIL_NOT_CONFIGURED",
  });
}

/**
 * Called instead of sending mail when email is off. Locally the link goes to the dev log;
 * deployed, the event is logged without the link or recipient and the request fails.
 */
export function deliverAuthLinkWithoutEmail(
  deps: { readonly logger: Logger; readonly environment: string },
  input: {
    readonly subject: string;
    readonly to: string;
    readonly url: string;
  }
): void {
  if (mayLogAuthLinks(deps.environment)) {
    deps.logger.info("auth.mail_not_sent", {
      "app.auth.mail.subject": input.subject,
      "app.auth.mail.recipient": input.to,
      "app.auth.link": input.url,
    });
    return;
  }
  deps.logger.error("auth.mail_not_sent", {
    "app.auth.mail.subject": input.subject,
    "app.auth.mail.reason": "email is not configured",
  });
  throw emailNotConfiguredError();
}
