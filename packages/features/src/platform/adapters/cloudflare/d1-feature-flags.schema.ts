// Tables of the D1 feature-flag provider (FEATURE_FLAGS=d1). They belong to the adapter,
// not to a feature: another provider (LaunchDarkly, PostHog) keeps its configuration in
// the vendor. drizzle.config.ts includes platform/adapters/*/*.schema.ts.
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const featureFlags = sqliteTable("feature_flags", {
  key: text("key").primaryKey(),
  enabled: integer("enabled", { mode: "boolean" }).notNull(),
  /** JSON of the value when no rule matches; null means the catalog default. */
  fallthroughJson: text("fallthrough_json"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  /** User id of the last writer; no foreign key, platform does not know accounts. */
  updatedBy: text("updated_by"),
});

export const featureFlagRules = sqliteTable(
  "feature_flag_rules",
  {
    id: text("id").primaryKey(),
    flagKey: text("flag_key")
      .notNull()
      .references(() => featureFlags.key, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    kind: text("kind", {
      enum: ["workspace", "plan", "percentage"],
    }).notNull(),
    workspaceId: text("workspace_id"),
    planId: text("plan_id"),
    /** Basis points, 0–10000 (percentage rules only). */
    percentageBp: integer("percentage_bp"),
    valueJson: text("value_json").notNull(),
  },
  (table) => [index("feature_flag_rules_flag_key_idx").on(table.flagKey)]
);
