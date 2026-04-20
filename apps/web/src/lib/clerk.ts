interface ClerkApiError {
  readonly code?: string;
  readonly longMessage?: string;
  readonly message?: string;
}

const REVERIFICATION_ERROR_CODE = "session_reverification_required";

export function getClerkErrorMessage(
  error: unknown,
  fallback = "Something went wrong"
) {
  if (!error || typeof error !== "object") {
    return fallback;
  }

  const errors = (error as { errors?: readonly ClerkApiError[] }).errors;
  if (Array.isArray(errors) && errors.length > 0) {
    return (
      errors.find((entry) => entry?.longMessage)?.longMessage ??
      errors.find((entry) => entry?.message)?.message ??
      fallback
    );
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export function isReverificationRequired(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const errors = (error as { errors?: readonly ClerkApiError[] }).errors;
  if (!Array.isArray(errors)) {
    return false;
  }

  return errors.some((entry) => entry?.code === REVERIFICATION_ERROR_CODE);
}
