import { DomainError } from "../../kernel";

/** No user with that id. */
export class AdminUserNotFoundError extends DomainError {
  constructor() {
    super("not_found", "User not found");
  }
}

/** Admins do not ban, demote, delete, sign out or impersonate themselves from the portal. */
export class SelfActionError extends DomainError {
  constructor(operation: string) {
    super("forbidden", `You cannot ${operation} your own account`);
  }
}

/** The change would leave the app without an active admin. */
export class LastAdminError extends DomainError {
  constructor() {
    super(
      "conflict",
      "The app needs at least one active admin: make someone else an admin first",
      "LAST_ADMIN"
    );
  }
}

/** Admins and suspended users cannot be impersonated. */
export class CannotImpersonateError extends DomainError {
  constructor(reason: "admin" | "banned") {
    super(
      "forbidden",
      reason === "admin"
        ? "Admins cannot be impersonated"
        : "Suspended users cannot be impersonated"
    );
  }
}

/** A suspension ends in the future, or never. */
export class InvalidBanExpiryError extends DomainError {
  constructor() {
    super("invalid_input", "The suspension must end in the future");
  }
}

/** The workspace still has an owner; they transfer ownership themselves. */
export class WorkspaceHasOwnerError extends DomainError {
  constructor() {
    super(
      "conflict",
      "The workspace has an owner: ask them to transfer ownership instead"
    );
  }
}

/** The environment cannot send password reset links (no email configured). */
export class PasswordResetUnavailableError extends DomainError {
  constructor(message: string) {
    super("unavailable", message);
  }
}

/**
 * A destructive admin action needs a recent sign-in (RECENT_SIGN_IN_MS). Clients branch on
 * the code (`data.appCode` in tRPC) to ask the admin to sign in again.
 */
export class ReauthRequiredError extends DomainError {
  static readonly CODE = "REAUTH_REQUIRED";

  constructor() {
    super(
      "forbidden",
      "Sign in again to confirm it's you: this action needs a sign-in from the last 15 minutes",
      ReauthRequiredError.CODE
    );
  }
}

/** A malformed list query or cursor. */
export class InvalidAdminQueryError extends DomainError {
  constructor(message: string) {
    super("invalid_input", message);
  }
}

/** Stopping an impersonation outside one. */
export class NotImpersonatingError extends DomainError {
  constructor() {
    super("invalid_input", "You are not impersonating anyone");
  }
}
