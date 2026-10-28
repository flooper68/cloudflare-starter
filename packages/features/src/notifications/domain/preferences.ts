import type { NotificationChannel, NotificationDefinition } from "../../kernel";
import type { NotificationCatalog } from "./catalog";

/** How a user's notification mail arrives: one mail each, or one summary a day. */
export const EMAIL_CADENCES = ["instant", "daily"] as const;
export type EmailCadence = (typeof EMAIL_CADENCES)[number];

/** A user who never chose gets each mail at once. */
export const DEFAULT_EMAIL_CADENCE: EmailCadence = "instant";

/** A stored preference: only where the user differs from the type's default. */
export interface PreferenceOverride {
  readonly type: string;
  readonly channel: NotificationChannel;
  readonly enabled: boolean;
}

export interface ResolvedChannels {
  readonly inApp: boolean;
  readonly email: boolean;
}

type Rules = Pick<
  NotificationDefinition<unknown>,
  "type" | "defaultChannels" | "securityCritical"
>;

/** Whether the user may change this channel of the type: never for security notifications. */
export function isLocked(definition: Rules): boolean {
  return definition.securityCritical;
}

/**
 * The channels one user gets for one type: the type's defaults, changed by the user's
 * overrides. Security-critical types ignore overrides and always mail.
 */
export function resolveChannels(
  definition: Rules,
  overrides: readonly PreferenceOverride[]
): ResolvedChannels {
  if (definition.securityCritical) {
    return { inApp: definition.defaultChannels.inApp, email: true };
  }
  const override = (channel: NotificationChannel) =>
    overrides.find(
      (entry) => entry.type === definition.type && entry.channel === channel
    )?.enabled;
  return {
    inApp: override("inApp") ?? definition.defaultChannels.inApp,
    email: override("email") ?? definition.defaultChannels.email,
  };
}

/** What happens to the email channel of a new inbox row. */
export type EmailState = "none" | "pending" | "pending_digest" | "skipped";

/**
 * The email state of a new row: none when the channel is off, skipped when email is not
 * configured, pending (send now) for security notifications and instant cadence, and
 * pending_digest for the daily summary.
 */
export function initialEmailState(
  definition: Rules,
  channels: ResolvedChannels,
  input: { readonly cadence: EmailCadence; readonly emailEnabled: boolean }
): EmailState {
  if (!channels.email) return "none";
  if (!input.emailEnabled) return "skipped";
  if (definition.securityCritical || input.cadence === "instant") {
    return "pending";
  }
  return "pending_digest";
}

/**
 * How a preference change is stored: an override, or none when it equals the default
 * (the table keeps differences only). Throws for a locked type (see isLocked).
 */
export function storedOverride(
  definition: Rules,
  channel: NotificationChannel,
  enabled: boolean
): "delete" | "upsert" {
  return definition.defaultChannels[channel] === enabled ? "delete" : "upsert";
}

/** One row of the preferences matrix. */
export interface PreferenceRow {
  readonly type: string;
  readonly label: string;
  readonly locked: boolean;
  readonly inApp: boolean;
  readonly email: boolean;
}

/** The matrix the preferences screen shows: every catalog type with its resolved channels. */
export function preferenceMatrix(
  catalog: NotificationCatalog,
  overrides: readonly PreferenceOverride[]
): PreferenceRow[] {
  return [...catalog.values()].map((definition) => ({
    type: definition.type,
    label: definition.label,
    locked: isLocked(definition),
    ...resolveChannels(definition, overrides),
  }));
}
