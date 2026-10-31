import { z } from "zod";

function supportsTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
function supportsLocale(value: string): boolean {
  try {
    return Intl.DateTimeFormat.supportedLocalesOf([value]).length === 1;
  } catch {
    return false;
  }
}
/** Validate Intl inputs at the boundary so formatting never breaks the app. */
export const accountSettingsSchema = z.object({
  theme: z.enum(["system", "light", "dark"]),
  timezone: z
    .string()
    .min(1)
    .max(100)
    .refine(supportsTimezone, "Choose a valid time zone"),
  locale: z
    .string()
    .min(2)
    .max(50)
    .refine(supportsLocale, "Choose a supported locale"),
});
export type AccountSettingsInput = z.infer<typeof accountSettingsSchema>;
