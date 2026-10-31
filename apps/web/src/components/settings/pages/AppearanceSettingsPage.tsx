import {
  Button,
  Card,
  CardContent,
  DataState,
  EmptyState,
  Field,
  Input,
  Select,
  SelectItem,
  SkeletonCard,
  toast,
} from "@cloudflare-starter/ui";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { useAsync } from "@/lib/use-async";

export function AppearanceSettingsPage() {
  const loaded = useAsync(
    () => trpc.account.settings.get.query(),
    "appearance"
  );
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
  const [timezone, setTimezone] = useState("UTC");
  const [locale, setLocale] = useState("en");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (loaded.data) {
      setTheme(loaded.data.theme);
      setTimezone(loaded.data.timezone);
      setLocale(loaded.data.locale);
    }
  }, [loaded.data]);
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-fg">Appearance & language</h2>
      <DataState
        {...loaded}
        onRetry={loaded.refetch}
        loading={<SkeletonCard />}
        empty={
          <EmptyState
            title="Preferences unavailable"
            description="Reload this page to try again."
          />
        }
      >
        {() => (
          <Card>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  setSaving(true);
                  void trpc.account.settings.update
                    .mutate({ theme, timezone, locale })
                    .then(() => {
                      toast.success("Preferences saved");
                      window.location.reload();
                    })
                    .catch((error) => toast.error(error.message))
                    .finally(() => setSaving(false));
                }}
              >
                <Field label="Theme">
                  <Select
                    value={theme}
                    onValueChange={(value) =>
                      setTheme(value as "system" | "light" | "dark")
                    }
                  >
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                  </Select>
                </Field>
                <Field
                  label="Time zone"
                  description="An IANA time zone, for example Europe/Prague or America/New_York."
                >
                  <Input
                    required
                    value={timezone}
                    onChange={(event) => setTimezone(event.target.value)}
                  />
                </Field>
                <Field
                  label="Locale"
                  description="Formatting for dates and numbers, for example en, cs-CZ or de-DE."
                >
                  <Input
                    required
                    value={locale}
                    onChange={(event) => setLocale(event.target.value)}
                  />
                </Field>
                <Button type="submit" disabled={saving}>
                  Save preferences
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </DataState>
    </div>
  );
}
