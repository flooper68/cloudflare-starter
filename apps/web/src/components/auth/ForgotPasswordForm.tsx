import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  FieldError,
  Input,
  Label,
  Logo,
} from "@cloudflare-starter/ui";
import { type FormEvent, useState } from "react";

import { authClient, authErrorMessage } from "@/lib/auth-client";
import {
  AuthGuardFields,
  type HumanCheckConfig,
  useAuthGuard,
} from "./use-auth-guard";

export function ForgotPasswordForm({
  humanCheck,
}: {
  /** Turnstile site key when TURNSTILE=on. */
  readonly humanCheck: HumanCheckConfig;
}) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const guard = useAuthGuard(humanCheck);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!email.trim()) {
      setFieldError("Email is required");
      return;
    }

    setLoading(true);

    // Better Auth answers the same way whether or not the account exists.
    const { error: requestError } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
      fetchOptions: guard.fetchOptions,
    });
    guard.settle();

    setLoading(false);

    if (requestError) {
      // A 429 shows the rate-limit notice instead (useAuthGuard).
      if (requestError.status !== 429) {
        setError(authErrorMessage(requestError, "Unable to send reset link."));
      }
      return;
    }

    setSent(true);
  }

  return (
    <Card className="w-full max-w-md space-y-6">
      <CardHeader>
        <Logo className="mb-3" />
        <CardTitle>Reset password</CardTitle>
        <p className="text-sm text-fg-muted">
          {sent
            ? `If an account exists for ${email}, a reset link is on its way.`
            : "Enter your email and we will send you a reset link."}
        </p>
      </CardHeader>

      {sent ? null : (
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                aria-invalid={Boolean(fieldError)}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setFieldError(undefined);
                }}
              />
              <FieldError message={fieldError} />
            </div>

            <AuthGuardFields
              guard={guard}
              action="password-reset"
              subject="reset requests"
            />

            {error ? <p className="text-sm text-danger">{error}</p> : null}

            <Button
              className="w-full"
              disabled={loading || !guard.ready}
              type="submit"
              variant="primary"
            >
              {loading ? "Sending link..." : "Send reset link"}
            </Button>
          </form>
        </CardContent>
      )}

      <CardFooter className="justify-center">
        <p className="text-sm text-fg-muted">
          Back to{" "}
          <a
            className="font-medium text-accent underline underline-offset-4"
            href="/sign-in"
          >
            sign in
          </a>
        </p>
      </CardFooter>
    </Card>
  );
}
