import {
  Button,
  Card,
  CardTitle,
  Checkbox,
  ErrorState,
  Field,
  OneTimeCodeInput,
} from "@cloudflare-starter/ui";
import { useState } from "react";
import { afterSignIn, authClient, authErrorMessage } from "@/lib/auth-client";

/** Completes the native sign-in challenge; codes never leave this browser/auth endpoint. */
export function TwoFactorChallenge({
  emailOtp,
  trustedDays,
  search,
}: {
  readonly emailOtp: boolean;
  readonly trustedDays: number;
  readonly search: string;
}) {
  const [method, setMethod] = useState<"totp" | "backup" | "email">("totp");
  const [code, setCode] = useState("");
  const [trust, setTrust] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function verify() {
    setPending(true);
    setError(null);
    try {
      const body = { code, trustDevice: trust && trustedDays > 0 };
      const result =
        method === "backup"
          ? await authClient.twoFactor.verifyBackupCode(body)
          : method === "email"
            ? await authClient.twoFactor.verifyOtp(body)
            : await authClient.twoFactor.verifyTotp(body);
      if (result.error) {
        setError(authErrorMessage(result.error));
        return;
      }
      window.location.href = afterSignIn(result.data, search);
    } catch {
      setError("Couldn't verify the code. Try again.");
    } finally {
      setPending(false);
    }
  }
  async function sendEmail() {
    setPending(true);
    setError(null);
    try {
      const result = await authClient.twoFactor.sendOtp();
      if (result.error) setError(authErrorMessage(result.error));
      else {
        setMethod("email");
        setCode("");
      }
    } catch {
      setError("Couldn't send the verification code.");
    } finally {
      setPending(false);
    }
  }
  return (
    <Card className="w-full max-w-md space-y-4">
      <CardTitle>Verify it's you</CardTitle>
      <p className="text-sm text-fg-muted">
        {method === "backup"
          ? "Enter one of your saved recovery codes."
          : method === "email"
            ? "Enter the code sent to your email."
            : "Enter the six-digit code from your authenticator app."}
      </p>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void verify();
        }}
      >
        <Field
          label={method === "backup" ? "Recovery code" : "Verification code"}
        >
          <OneTimeCodeInput
            recovery={method === "backup"}
            value={code}
            onValueChange={setCode}
          />
        </Field>
        {trustedDays > 0 ? (
          <Checkbox
            label={`Remember this device for ${trustedDays} days`}
            checked={trust}
            onCheckedChange={(value) => setTrust(value === true)}
          />
        ) : null}
        {error ? <ErrorState variant="inline" description={error} /> : null}
        <Button
          type="submit"
          variant="primary"
          loading={pending}
          disabled={!code}
        >
          Verify
        </Button>
      </form>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() => {
            setMethod(method === "backup" ? "totp" : "backup");
            setCode("");
            setError(null);
          }}
        >
          {method === "backup" ? "Use authenticator" : "Use a recovery code"}
        </Button>
        {emailOtp ? (
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => void sendEmail()}
          >
            Email me a code
          </Button>
        ) : null}
        <Button variant="ghost" asChild>
          <a href="/sign-in">Back to sign in</a>
        </Button>
      </div>
    </Card>
  );
}
