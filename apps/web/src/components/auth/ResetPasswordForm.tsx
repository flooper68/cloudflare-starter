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
} from "@cloudflare-starter/ui";
import { type FormEvent, useState } from "react";

import { authClient, authErrorMessage } from "@/lib/auth-client";

interface FieldErrors {
  password?: string;
  confirmPassword?: string;
}

export function ResetPasswordForm({
  token,
}: {
  readonly token: string | null;
}) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(
    token ? null : "This reset link is invalid or has expired."
  );
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function validateForm() {
    const next: FieldErrors = {};

    if (!password) next.password = "New password is required";
    if (!confirmPassword) next.confirmPassword = "Please confirm the password";
    if (password && confirmPassword && password !== confirmPassword) {
      next.confirmPassword = "Passwords do not match";
    }

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!token || !validateForm()) {
      return;
    }

    setLoading(true);

    const { error: resetError } = await authClient.resetPassword({
      newPassword: password,
      token,
    });

    setLoading(false);

    if (resetError) {
      setError(authErrorMessage(resetError, "Unable to reset password."));
      return;
    }

    setDone(true);
  }

  return (
    <Card className="w-full max-w-md space-y-6">
      <CardHeader>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-700">
          Cloudflare Starter
        </p>
        <CardTitle>Choose a new password</CardTitle>
        {done ? (
          <p className="text-sm text-zinc-600">
            Password updated. Other sessions were signed out.
          </p>
        ) : null}
      </CardHeader>

      {done || !token ? (
        error ? (
          <CardContent>
            <p className="text-sm text-red-600">{error}</p>
          </CardContent>
        ) : null
      ) : (
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                aria-invalid={Boolean(fieldErrors.password)}
                onChange={(event) => setPassword(event.target.value)}
              />
              <FieldError message={fieldErrors.password} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                aria-invalid={Boolean(fieldErrors.confirmPassword)}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
              <FieldError message={fieldErrors.confirmPassword} />
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <Button className="w-full" disabled={loading} type="submit">
              {loading ? "Resetting password..." : "Reset password"}
            </Button>
          </form>
        </CardContent>
      )}

      <CardFooter className="justify-center">
        <a
          className="text-sm font-medium text-teal-700 underline underline-offset-4"
          href={done ? "/sign-in" : "/forgot-password"}
        >
          {done ? "Sign in" : "Request a new link"}
        </a>
      </CardFooter>
    </Card>
  );
}
