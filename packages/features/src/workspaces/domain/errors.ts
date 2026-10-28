import { DomainError } from "../../kernel";

/** The workspace does not exist or the user is not a member (indistinguishable on purpose). */
export class WorkspaceNotFoundError extends DomainError {
  constructor() {
    super("not_found", "Workspace not found");
  }
}

/** The member's role does not allow the action (permissions.ts). */
export class ActionNotAllowedError extends DomainError {
  constructor(action: string) {
    super("forbidden", `Your role does not allow ${action}`);
  }
}

/** The configured WORKSPACE_MODE does not offer this operation. */
export class WorkspaceModeError extends DomainError {
  constructor(mode: string, operation: string) {
    super("forbidden", `${operation} is not available in ${mode} mode`);
  }
}

/** The change would leave the workspace without anyone who can manage its members. */
export class LastOwnerError extends DomainError {
  constructor() {
    super(
      "conflict",
      "A workspace needs someone who can manage its members: transfer ownership first"
    );
  }
}

/** The user is not a member of the workspace. */
export class MemberNotFoundError extends DomainError {
  constructor() {
    super("not_found", "Member not found");
  }
}

/** Ownership goes to another member, not to the current owner. */
export class TransferToSelfError extends DomainError {
  constructor() {
    super("invalid_input", "Choose another member to transfer ownership to");
  }
}

/** The email already belongs to a member of the workspace. */
export class AlreadyMemberError extends DomainError {
  constructor() {
    super("conflict", "That person is already a member");
  }
}

/** No usable invitation for this token or id (unknown, revoked or already used). */
export class InvitationNotFoundError extends DomainError {
  constructor() {
    super("not_found", "Invitation not found");
  }
}

/** The invitation is past its expiry. */
export class InvitationExpiredError extends DomainError {
  constructor() {
    super("invalid_input", "This invitation has expired");
  }
}

/** The invitation was sent to another email address than the signed-in user's. */
export class InvitationWrongAccountError extends DomainError {
  constructor() {
    super("forbidden", "This invitation was sent to another email address");
  }
}

/** A personal workspace has exactly one member; it cannot be left or shared. */
export class PersonalWorkspaceError extends DomainError {
  constructor(operation: string) {
    super("forbidden", `${operation} is not possible in a personal workspace`);
  }
}

/** Sign-up refused by the configured policy (SIGN_UP, SIGN_UP_DOMAINS, invitations). */
export class SignUpNotAllowedError extends DomainError {
  /** Stable code the auth adapter returns and the sign-in page maps to a message. */
  static readonly CODE = "SIGN_UP_INVITE_ONLY";

  constructor() {
    super("forbidden", "Sign-up is by invitation only");
  }
}
