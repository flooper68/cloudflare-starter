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

import { afterSignIn, authClient, authErrorMessage } from "@/lib/auth-client";
import { GoogleSignInButton } from "./GoogleSignInButton";

interface FieldErrors {
  email?: string;
  password?: string;
}

export function SignInForm({
  emailPassword,
  google,
  search,
}: {
  readonly emailPassword: boolean;
  readonly google: boolean;
  /** The page query, kept on links so an OAuth authorization survives sign-up. */
  readonly search: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function clearField(field: keyof FieldErrors) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function validateForm() {
    const next: FieldErrors = {};

    if (!email.trim()) next.email = "Email is required";
    if (!password) next.password = "Password is required";

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    const { data, error: signInError } = await authClient.signIn.email({
      email,
      password,
    });

    if (signInError) {
      setError(authErrorMessage(signInError, "Unable to sign in."));
      setLoading(false);
      return;
    }

    window.location.href = afterSignIn(data);
  }

  return (
    <Card className="w-full max-w-md space-y-6">
      <CardHeader>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-700">
          Cloudflare Starter
        </p>
        <CardTitle>Sign in</CardTitle>
        <p className="text-sm text-zinc-600">
          {emailPassword
            ? "Sign in with your email and password to enter the app."
            : "Sign in with your Google account to enter the app."}
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {emailPassword ? (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                aria-invalid={Boolean(fieldErrors.email)}
                onChange={(event) => {
                  setEmail(event.target.value);
                  clearField("email");
                }}
              />
              <FieldError message={fieldErrors.email} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="password">Password</Label>
                <a
                  className="text-xs font-medium text-teal-700 underline underline-offset-4"
                  href="/forgot-password"
                >
                  Forgot password?
                </a>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                aria-invalid={Boolean(fieldErrors.password)}
                onChange={(event) => {
                  setPassword(event.target.value);
                  clearField("password");
                }}
              />
              <FieldError message={fieldErrors.password} />
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <Button className="w-full" disabled={loading} type="submit">
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : null}

        {google ? <GoogleSignInButton onError={setError} /> : null}
      </CardContent>

      <CardFooter className="justify-center">
        <p className="text-sm text-zinc-600">
          Don&apos;t have an account?{" "}
          <a
            className="font-medium text-teal-700 underline underline-offset-4"
            href={`/sign-up${search}`}
          >
            Sign up
          </a>
        </p>
      </CardFooter>
    </Card>
  );
}
