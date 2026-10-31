import { useMemo } from "react";
import { useAuth } from "@/components/shared/spa/auth-context";

/** Formatting uses the person's saved locale and time zone on every settings screen. */
export function useFormatters() {
  const { settings } = useAuth();
  const locale = settings?.locale ?? "en";
  const timeZone = settings?.timezone ?? "UTC";
  return useMemo(
    () => ({
      dateTime: (value: Date) =>
        new Intl.DateTimeFormat(locale, {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone,
        }).format(value),
      number: (value: number) => new Intl.NumberFormat(locale).format(value),
    }),
    [locale, timeZone]
  );
}
