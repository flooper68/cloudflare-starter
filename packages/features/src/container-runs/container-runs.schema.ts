import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { user } from "../accounts";
import { workspaces } from "../workspaces";

/**
 * One run of the container workflow demo (docs/guides/how-to-run-container-workflows.md):
 * digits of pi computed in a Cloudflare Container, orchestrated by a Workflow whose
 * instance id is the run's id. `steps` is the step timeline as JSON
 * (domain/run-steps.ts), written by each workflow step as it starts and ends. The result
 * text is in R2 (`result_key`, the FILES bucket); the row and the object expire after
 * CONTAINER_RUN_RETENTION_DAYS (`expires_at`, purged daily).
 */
export const containerRuns = sqliteTable(
  "container_runs",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** Who started it: attribution and who is notified. */
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    digits: integer("digits").notNull(),
    /** queued | running | succeeded | failed (domain/run-steps.ts, RUN_STATUSES). */
    status: text("status").notNull(),
    /** The step timeline, JSON (RunStep[]). */
    steps: text("steps").notNull(),
    /** A stable failure code (RUN_ERROR_CODES), never a raw error message. */
    errorCode: text("error_code"),
    /** The failed run this one retries, if any. */
    retryOf: text("retry_of"),
    resultKey: text("result_key"),
    /** The first digits of the result, for the page without a download. */
    resultPreview: text("result_preview"),
    resultBytes: integer("result_bytes"),
    /** Compute time the container reported, in milliseconds. */
    computeMs: integer("compute_ms"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    // The past runs list: a workspace's runs, newest first.
    index("container_runs_workspace_id_created_at_idx").on(
      table.workspaceId,
      table.createdAt
    ),
    // The daily purge of expired runs.
    index("container_runs_expires_at_idx").on(table.expiresAt),
  ]
);

/**
 * The global daily cap (CONTAINER_DEMO_DAILY_CAP): runs started per UTC day across the
 * whole deployment, counted with one atomic upsert per start. Not tenant data: deleting a
 * workspace (and its runs) must not give the day's runs back.
 */
export const containerRunQuota = sqliteTable("container_run_quota", {
  /** The UTC day, YYYY-MM-DD. */
  day: text("day").primaryKey(),
  count: integer("count").notNull(),
});

/**
 * The per-user hourly limit (CONTAINER_RUN_USER_HOURLY_LIMIT): runs a person started per
 * UTC hour, across workspaces, counted with one atomic upsert per start. Keyed by the
 * person, not the workspace, so deleting a workspace (and its runs) does not give the
 * hour's runs back; it goes with the account. Rows older than a day are purged daily.
 */
export const containerRunUserQuota = sqliteTable(
  "container_run_user_quota",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** The UTC hour, YYYY-MM-DDTHH. */
    hour: text("hour").notNull(),
    count: integer("count").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.hour] })]
);
