import { z } from "zod";

export const TWO_FACTOR_MODES = [
  "off",
  "optional",
  "required-for-admins",
  "required",
] as const;
export const securitySettingsSchema = z
  .object({
    TWO_FACTOR: z.enum(TWO_FACTOR_MODES),
    TWO_FACTOR_EMAIL_OTP: z.enum(["on", "off"]),
    TWO_FACTOR_TRUSTED_DEVICE_DAYS: z.coerce.number().int().min(0).max(30),
    PASSKEYS: z.enum(["on", "off"]),
  })
  .transform((env) => ({
    mode: env.TWO_FACTOR,
    emailOtp: env.TWO_FACTOR_EMAIL_OTP === "on",
    trustedDeviceDays: env.TWO_FACTOR_TRUSTED_DEVICE_DAYS,
    passkeys: env.PASSKEYS === "on",
  }));
export type SecuritySettings = z.infer<typeof securitySettingsSchema>;
export type SecurityDecision =
  | "allowed"
  | "enrollment_required"
  | "step_up_required";

/** Enrollment and evidence are separate: only a verified session satisfies a factor. */
export function securityDecision(
  settings: SecuritySettings,
  input: {
    readonly role: string | null;
    readonly enrolled: boolean;
    readonly verified: boolean;
  }
): SecurityDecision {
  if (settings.mode === "off") return "allowed";
  const required =
    settings.mode === "required" ||
    (settings.mode === "required-for-admins" &&
      input.role
        ?.split(",")
        .map((role) => role.trim())
        .includes("admin"));
  if (required && !input.enrolled) return "enrollment_required";
  return input.enrolled && !input.verified ? "step_up_required" : "allowed";
}
