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

type Step = "form" | "verification";

interface FieldErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  code?: string;
}

export function SignUpForm() {
  const clerk = useClerkInstance();

  const [step, setStep] = useState<Step>("form");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
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

    if (!firstName.trim()) next.firstName = "First name is required";
    if (!lastName.trim()) next.lastName = "Last name is required";
    if (!email.trim()) next.email = "Email is required";
    if (!password) next.password = "Password is required";

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  function validateCode() {
    const next: FieldErrors = {};

    if (!code.trim()) next.code = "Verification code is required";

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
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
      await clerk.client.signUp.create({
        firstName,
        lastName,
        emailAddress: email,
        password,
      });

      await clerk.client.signUp.prepareEmailAddressVerification({
        strategy: "email_code",
      });

      setFieldErrors({});
      setStep("verification");
    } catch (cause) {
      setError(getClerkErrorMessage(cause, "Unable to sign up."));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!clerk?.client) {
      setError("Clerk is still loading.");
      return;
    }

    if (!validateCode()) {
      return;
    }

    setLoading(true);

    try {
      const result = await clerk.client.signUp.attemptEmailAddressVerification({
        code,
      });

      if (result.status === "complete") {
        await clerk.setActive({ session: result.createdSessionId });
        window.location.href = "/app/dashboard";
        return;
      }

      setError("Verification could not be completed.");
    } catch (cause) {
      setError(getClerkErrorMessage(cause, "Unable to verify your email."));
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
        <CardTitle>
          {step === "form" ? "Create an account" : "Verify your email"}
        </CardTitle>
        <p className="text-sm text-zinc-600">
          {step === "form"
            ? "Use email and password auth, following the same custom Clerk pattern as Vertical Casting Hub."
            : `We sent a verification code to ${email}.`}
        </p>
      </CardHeader>

      <CardContent>
        {step === "form" ? (
          <form className="space-y-4" onSubmit={handleCreate}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  type="text"
                  autoComplete="given-name"
                  value={firstName}
                  aria-invalid={Boolean(fieldErrors.firstName)}
                  onChange={(event) => {
                    setFirstName(event.target.value);
                    clearField("firstName");
                  }}
                />
                <FieldError message={fieldErrors.firstName} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  type="text"
                  autoComplete="family-name"
                  value={lastName}
                  aria-invalid={Boolean(fieldErrors.lastName)}
                  onChange={(event) => {
                    setLastName(event.target.value);
                    clearField("lastName");
                  }}
                />
                <FieldError message={fieldErrors.lastName} />
              </div>
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
        ) : (
          <form className="space-y-4" onSubmit={handleVerification}>
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

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <Button className="w-full" disabled={loading} type="submit">
              {loading ? "Verifying..." : "Verify email"}
            </Button>
          </form>
        )}
      </CardContent>

      <CardFooter className="justify-center">
        <p className="text-sm text-zinc-600">
          Already have an account?{" "}
          <a
            className="font-medium text-teal-700 underline underline-offset-4"
            href="/sign-in"
          >
            Sign in
          </a>
        </p>
      </CardFooter>
    </Card>
  );
}
