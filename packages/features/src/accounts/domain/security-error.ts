import { DomainError } from "../../kernel";
export class SecondFactorRequiredError extends DomainError {
  constructor(enrollment = false) {
    super(
      "forbidden",
      enrollment
        ? "Set up two-factor authentication to continue."
        : "Verify a second factor to continue.",
      enrollment ? "SECOND_FACTOR_ENROLLMENT_REQUIRED" : "STEP_UP_REQUIRED"
    );
  }
}
