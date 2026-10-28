import { Lock, Settings2 } from "lucide-react";
import { useId } from "react";

import { Callout } from "../callout";
import { DataState, type DataStatus } from "../data-state";
import { EmptyState } from "../empty-state";
import { SegmentedControl, SegmentedControlItem } from "../segmented-control";
import { Skeleton } from "../skeleton";
import { Switch } from "../switch";

/** One notification type's row: its label, channels, and whether it is locked on. */
export interface NotificationPreferenceRow {
  readonly type: string;
  readonly label: string;
  readonly locked: boolean;
  readonly inApp: boolean;
  readonly email: boolean;
}

export type NotificationChannelName = "inApp" | "email";
export type EmailCadenceOption = "instant" | "daily";

export interface NotificationPreferencesData {
  readonly types: readonly NotificationPreferenceRow[];
  readonly emailCadence: EmailCadenceOption;
  /** False when the deployment sends no email: the email column is off and says why. */
  readonly emailAvailable: boolean;
}

export interface NotificationPreferencesProps {
  readonly status: DataStatus;
  readonly data: NotificationPreferencesData | undefined;
  readonly error?: unknown;
  readonly onRetry?: () => unknown;
  /** A switch changed; it applies at once (the caller saves and reports failures). */
  readonly onToggle?: (
    type: string,
    channel: NotificationChannelName,
    enabled: boolean
  ) => void;
  readonly onCadenceChange?: (cadence: EmailCadenceOption) => void;
}

function PreferencesSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3 p-4">
      {Array.from({ length: 4 }, (_, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
          key={index}
          className="flex items-center gap-4"
        >
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-5 w-9 rounded-full" />
          <Skeleton className="h-5 w-9 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/**
 * The notification preferences: a matrix of notification types (rows) and channels
 * (in-app, email), and the email cadence (each mail at once, or a daily digest). Security
 * notifications are locked on. Switches apply at once.
 */
export function NotificationPreferences({
  status,
  data,
  error,
  onRetry,
  onToggle,
  onCadenceChange,
}: NotificationPreferencesProps) {
  const cadenceLabelId = useId();
  return (
    <DataState
      status={status}
      data={data}
      error={error}
      onRetry={onRetry}
      isEmpty={(value) => value.types.length === 0}
      loading={<PreferencesSkeleton />}
      empty={
        <EmptyState
          variant="compact"
          icon={<Settings2 />}
          title="No notifications to configure"
          description="This app sends no notifications yet."
        />
      }
    >
      {(value) => (
        <div className="flex flex-col gap-4 p-4">
          {value.emailAvailable ? null : (
            <Callout
              tone="info"
              title="Email is not set up for this app"
              description="Notifications appear in the app only. An administrator can turn on email."
            />
          )}
          <table className="w-full text-sm">
            <caption className="sr-only">Notification channels by type</caption>
            <thead>
              <tr className="border-b border-line text-left text-xs text-fg-muted">
                <th scope="col" className="py-2 font-medium">
                  Notify me when
                </th>
                <th scope="col" className="w-20 py-2 text-center font-medium">
                  In app
                </th>
                <th scope="col" className="w-20 py-2 text-center font-medium">
                  Email
                </th>
              </tr>
            </thead>
            <tbody>
              {value.types.map((row) => (
                <tr
                  key={row.type}
                  className="border-b border-line last:border-0"
                >
                  <th
                    scope="row"
                    className="py-2.5 pr-4 text-left font-normal text-fg"
                  >
                    <span className="flex items-center gap-1.5">
                      {row.label}
                      {row.locked ? (
                        <span className="inline-flex items-center gap-1 text-xs text-fg-muted">
                          <Lock aria-hidden className="size-3" />
                          Security, always on
                        </span>
                      ) : null}
                    </span>
                  </th>
                  {(["inApp", "email"] as const).map((channel) => (
                    <td key={channel} className="py-2.5 text-center">
                      <span className="inline-flex">
                        <Switch
                          aria-label={`${row.label}: ${channel === "inApp" ? "in app" : "email"}`}
                          checked={row[channel]}
                          disabled={
                            row.locked ||
                            (channel === "email" && !value.emailAvailable)
                          }
                          onCheckedChange={(checked) =>
                            onToggle?.(row.type, channel, checked)
                          }
                        />
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <div>
              <p id={cadenceLabelId} className="text-sm font-medium text-fg">
                Email delivery
              </p>
              <p className="text-xs text-fg-muted">
                Security notices always arrive at once.
              </p>
            </div>
            <SegmentedControl
              aria-labelledby={cadenceLabelId}
              value={value.emailCadence}
              disabled={!value.emailAvailable}
              onValueChange={(next) =>
                onCadenceChange?.(next as EmailCadenceOption)
              }
            >
              <SegmentedControlItem value="instant">
                Each at once
              </SegmentedControlItem>
              <SegmentedControlItem value="daily">
                Daily digest
              </SegmentedControlItem>
            </SegmentedControl>
          </div>
        </div>
      )}
    </DataState>
  );
}
