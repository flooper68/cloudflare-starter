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

type Step = "request" | "reset";

interface FieldErrors {
  email?: string;
  code?: string;
  password?: string;
}

export function ForgotPasswordForm() {
  const clerk = useClerkInstance();

  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
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

  function validateRequest() {
    const next: FieldErrors = {};

    if (!email.trim()) next.email = "Email is required";

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  function validateReset() {
    const next: FieldErrors = {};

    if (!code.trim()) next.code = "Verification code is required";
    if (!password) next.password = "New password is required";

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!clerk?.client) {
      setError("Clerk is still loading.");
      return;
    }

    if (!validateRequest()) {
      return;
    }

    setLoading(true);

    try {
      await clerk.client.signIn.create({
        strategy: "reset_password_email_code",
        identifier: email,
      });

      setFieldErrors({});
      setStep("reset");
    } catch (cause) {
      setError(getClerkErrorMessage(cause, "Unable to send reset code."));
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!clerk?.client) {
      setError("Clerk is still loading.");
      return;
    }

    if (!validateReset()) {
      return;
    }

    setLoading(true);

    try {
      const result = await clerk.client.signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code,
        password,
      });

      if (result.status === "complete") {
        await clerk.setActive({ session: result.createdSessionId });
        window.location.href = "/app/dashboard";
        return;
      }

      if (result.status === "needs_second_factor") {
        setError(
          "Two-factor authentication is required and is not handled by this page yet."
        );
        return;
      }

      setError("Password reset could not be completed.");
    } catch (cause) {
      setError(getClerkErrorMessage(cause, "Unable to reset password."));
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
        <CardTitle>Reset password</CardTitle>
        <p className="text-sm text-zinc-600">
          {step === "request"
            ? "Enter your email and Clerk will send a reset code."
            : `Enter the code sent to ${email} and choose a new password.`}
        </p>
      </CardHeader>

      <CardContent>
        {step === "request" ? (
          <form className="space-y-4" onSubmit={handleRequest}>
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

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <Button className="w-full" disabled={loading} type="submit">
              {loading ? "Sending code..." : "Send reset code"}
            </Button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={handleReset}>
            <div className="space-y-2">
              <Label htmlFor="code">Verification code</Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                placeholder="Enter code"
                value={code}
                aria-invalid={Boolean(fieldErrors.code)}
                onChange={(event) => {
                  setCode(event.target.value);
                  clearField("code");
                }}
              />
              <FieldError message={fieldErrors.code} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
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
              {loading ? "Resetting password..." : "Reset password"}
            </Button>
          </form>
        )}
      </CardContent>

      <CardFooter className="justify-center">
        <p className="text-sm text-zinc-600">
          Back to{" "}
          <a
            className="font-medium text-teal-700 underline underline-offset-4"
            href="/sign-in"
          >
            sign in
          </a>
        </p>
      </CardFooter>
    </Card>
  );
}
