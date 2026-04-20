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
import { type FormEvent, useEffect, useState } from "react";
import { useClerkInstance } from "@/components/shared/hooks/use-clerk-client";
import { getClerkErrorMessage } from "@/lib/clerk";

interface FieldErrors {
  email?: string;
  password?: string;
}

export function SignInForm() {
  const clerk = useClerkInstance();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (clerk?.session) {
      window.location.href = "/app/dashboard";
    }
  }, [clerk]);

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

    if (!clerk?.client) {
      setError("Clerk is still loading.");
      return;
    }

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const result = await clerk.client.signIn.create({
        strategy: "password",
        identifier: email,
        password,
      });

      if (result.status === "complete") {
        await clerk.setActive({ session: result.createdSessionId });
        window.location.href = "/app/dashboard";
        return;
      }

      setError("Sign in could not be completed.");
    } catch (cause) {
      setError(getClerkErrorMessage(cause, "Unable to sign in."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md space-y-6">
      <CardHeader>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-700">
          Cloudflare Starter
        </p>
        <CardTitle>Sign in</CardTitle>
        <p className="text-sm text-zinc-600">
          Sign in with your email and password to enter the app.
        </p>
      </CardHeader>

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
      </CardContent>

      <CardFooter className="justify-center">
        <p className="text-sm text-zinc-600">
          Don&apos;t have an account?{" "}
          <a
            className="font-medium text-teal-700 underline underline-offset-4"
            href="/sign-up"
          >
            Sign up
          </a>
        </p>
      </CardFooter>
    </Card>
  );
}
