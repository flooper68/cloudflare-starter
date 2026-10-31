import { Button } from "../button";
import { Card, CardTitle } from "../card";
import { Field } from "../field";
import { OneTimeCodeInput } from "../one-time-code-input";
export interface TotpSetupProps {
  readonly qrUrl: string;
  readonly secret: string;
  readonly code: string;
  readonly onCode: (code: string) => void;
  readonly onVerify: () => void;
  readonly pending?: boolean;
  readonly error?: string | null;
}
/** Authenticator enrollment with a QR code and a text alternative for manual setup. */
export function TotpSetup({
  qrUrl,
  secret,
  code,
  onCode,
  onVerify,
  pending,
  error,
}: TotpSetupProps) {
  return (
    <Card className="space-y-4">
      <CardTitle>Set up your authenticator</CardTitle>
      <p className="text-sm text-fg-muted">
        Scan this code in your authenticator app, then enter its six-digit code.
      </p>
      <img
        src={qrUrl}
        alt="Authenticator setup QR code"
        width={192}
        height={192}
      />
      <details>
        <summary className="cursor-pointer text-sm text-fg">
          Enter the setup key manually
        </summary>
        <code className="break-all text-sm text-fg">{secret}</code>
      </details>
      <Field label="Verification code" error={error}>
        <OneTimeCodeInput value={code} onValueChange={onCode} />
      </Field>
      <Button
        variant="primary"
        loading={pending}
        disabled={code.length !== 6}
        onClick={onVerify}
      >
        Verify and enable
      </Button>
    </Card>
  );
}
