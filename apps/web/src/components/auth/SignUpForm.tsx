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

const MIN_PASSWORD_LENGTH = 8;

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
}

export function SignUpForm({
  emailPassword,
  google,
  search,
}: {
  readonly emailPassword: boolean;
  readonly google: boolean;
  /** The page query, kept on links so an OAuth authorization survives. */
  readonly search: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);
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

    if (!name.trim()) next.name = "Name is required";
    if (!email.trim()) next.email = "Email is required";
    if (!password) next.password = "Password is required";
    else if (password.length < MIN_PASSWORD_LENGTH) {
      next.password = `Use at least ${MIN_PASSWORD_LENGTH} characters`;
    }

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

    // Signs the new user in right away, unless email verification is required:
    // then there is no session token and the verification link signs them in.
    const { data, error: signUpError } = await authClient.signUp.email({
      name: name.trim(),
      email,
      password,
      callbackURL: "/app/dashboard",
    });

    if (signUpError) {
      setError(authErrorMessage(signUpError, "Unable to sign up."));
      setLoading(false);
      return;
    }

    if (!data?.token) {
      setCheckEmail(true);
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
        <CardTitle>Create an account</CardTitle>
        <p className="text-sm text-zinc-600">
          {checkEmail
            ? `We sent a verification link to ${email}. Open it to finish signing up.`
            : emailPassword
              ? "Email and password accounts, stored in D1 by Better Auth."
              : "Use your Google account; the first sign-in creates it."}
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {emailPassword && !checkEmail ? (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                autoComplete="name"
                value={name}
                aria-invalid={Boolean(fieldErrors.name)}
                onChange={(event) => {
                  setName(event.target.value);
                  clearField("name");
                }}
              />
              <FieldError message={fieldErrors.name} />
            </div>

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
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
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
              {loading ? "Creating account..." : "Create account"}
            </Button>
          </form>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : null}

        {google && !checkEmail ? (
          <GoogleSignInButton onError={setError} />
        ) : null}
      </CardContent>

      <CardFooter className="justify-center">
        <p className="text-sm text-zinc-600">
          Already have an account?{" "}
          <a
            className="font-medium text-teal-700 underline underline-offset-4"
            href={`/sign-in${search}`}
          >
            Sign in
          </a>
        </p>
      </CardFooter>
    </Card>
  );
}
