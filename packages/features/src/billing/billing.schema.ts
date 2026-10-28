import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { user } from "../accounts";
import { workspaces } from "../workspaces";

import { SUBSCRIPTION_STATUSES } from "./domain";

const now = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

/**
 * A workspace's plan and where its subscription stands. No row: the default plan
 * (catalog DEFAULT_PLAN_ID). `provider` is "manual" or the provider adapter's name; the
 * provider ids link it to the provider's customer and subscription.
 */
export const workspaceSubscription = sqliteTable(
  "workspace_subscription",
  {
    workspaceId: text("workspace_id")
      .primaryKey()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    planId: text("plan_id").notNull(),
    status: text("status", { enum: SUBSCRIPTION_STATUSES }).notNull(),
    periodStart: integer("period_start", { mode: "timestamp_ms" }),
    periodEnd: integer("period_end", { mode: "timestamp_ms" }),
    trialEndsAt: integer("trial_ends_at", { mode: "timestamp_ms" }),
    provider: text("provider").notNull(),
    providerCustomerId: text("provider_customer_id"),
    providerSubscriptionId: text("provider_subscription_id"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(now)
      .notNull(),
  },
  (table) => [
    // expireTrials scans by status and the dates that end it.
    index("workspace_subscription_status_idx").on(
      table.status,
      table.trialEndsAt
    ),
  ]
);

/** Add-ons a workspace has, with their quantity. */
export const workspaceAddon = sqliteTable(
  "workspace_addon",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    addonId: text("addon_id").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (table) => [primaryKey({ columns: [table.workspaceId, table.addonId] })]
);

/**
 * An admin's exception for one workspace, winning over plan and add-ons: a feature granted
 * (`enabled` 1) or revoked (0), or a limit set (`limit_value`, NULL is unlimited).
 */
export const entitlementOverride = sqliteTable(
  "entitlement_override",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    kind: text("kind", { enum: ["feature", "limit"] }).notNull(),
    enabled: integer("enabled", { mode: "boolean" }),
    limit: integer("limit_value"),
    reason: text("reason").notNull(),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(now)
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.workspaceId, table.key] })]
);

/** Usage of a period metric per workspace and period (`YYYY-MM`). */
export const usageCounter = sqliteTable(
  "usage_counter",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    metric: text("metric").notNull(),
    period: text("period").notNull(),
    value: integer("value").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.metric, table.period] }),
  ]
);
