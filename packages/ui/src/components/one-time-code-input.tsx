import { Input, type InputProps } from "./input";
export interface OneTimeCodeInputProps extends Omit<InputProps, "onChange"> {
  readonly onValueChange: (value: string) => void;
  readonly recovery?: boolean;
}
/** A paste-friendly, keyboard-accessible single field for authenticator and recovery codes. */
export function OneTimeCodeInput({
  onValueChange,
  recovery = false,
  ...props
}: OneTimeCodeInputProps) {
  return (
    <Input
      aria-label={recovery ? "Recovery code" : "Verification code"}
      autoComplete="one-time-code"
      inputMode={recovery ? "text" : "numeric"}
      maxLength={recovery ? 32 : 6}
      {...props}
      onChange={(event) =>
        onValueChange(
          recovery
            ? event.target.value.trim()
            : event.target.value.replace(/\D/g, "").slice(0, 6)
        )
      }
    />
  );
}
