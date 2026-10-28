import { createMemoryLogger } from "@cloudflare-starter/features";
import { APIError } from "better-auth/api";
import { describe, expect, it } from "vitest";

import {
  deliverAuthLinkWithoutEmail,
  EMAIL_NOT_CONFIGURED_MESSAGE,
  mayLogAuthLinks,
} from "./auth-mail";

const link = {
  subject: "Reset your password",
  to: "nicole@example.test",
  url: "http://localhost:4321/api/auth/reset-password/tok_secret123?callbackURL=",
};

describe("auth links without email", () => {
  it("logs the link in local development", () => {
    const logger = createMemoryLogger();
    deliverAuthLinkWithoutEmail({ logger, environment: "local" }, link);
    expect(logger.records).toEqual([
      expect.objectContaining({
        severity_text: "INFO",
        body: "auth.mail_not_sent",
        attributes: {
          "app.auth.mail.subject": "Reset your password",
          "app.auth.mail.recipient": "nicole@example.test",
          "app.auth.link": link.url,
        },
      }),
    ]);
  });

  it.each(["develop", "staging", "production", ""])(
    "never logs the link in %j and refuses with a clear error",
    (environment) => {
      const logger = createMemoryLogger();
      let thrown: unknown;
      try {
        deliverAuthLinkWithoutEmail({ logger, environment }, link);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(APIError);
      expect((thrown as APIError).status).toBe("PRECONDITION_FAILED");
      expect((thrown as APIError).message).toBe(EMAIL_NOT_CONFIGURED_MESSAGE);
      expect(logger.records).toEqual([
        expect.objectContaining({
          severity_text: "ERROR",
          body: "auth.mail_not_sent",
          attributes: {
            "app.auth.mail.subject": "Reset your password",
            "app.auth.mail.reason": "email is not configured",
          },
        }),
      ]);
      expect(JSON.stringify(logger.records)).not.toMatch(/tok_secret|nicole/);
    }
  );

  it("treats only an explicit local environment as local", () => {
    expect(mayLogAuthLinks("local")).toBe(true);
    for (const environment of ["", "develop", "Local", "localhost"]) {
      expect(mayLogAuthLinks(environment)).toBe(false);
    }
  });
});
