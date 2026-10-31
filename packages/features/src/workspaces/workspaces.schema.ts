import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { user } from "../accounts";

const now = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

/** A workspace owns the app's data; `created_by` is attribution only, never access. */
export const workspaces = sqliteTable(
  "workspaces",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    logoKey: text("logo_key"),
    kind: text("kind", { enum: ["personal", "shared"] }).notNull(),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(now)
      .notNull(),
  },
  (table) => [index("workspaces_logo_key_idx").on(table.logoKey)]
);

/** Who belongs to a workspace and with which role (domain/permissions.ts). */
export const workspaceMembers = sqliteTable(
  "workspace_members",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(now)
      .notNull(),
    /** Set when the user switches to the workspace; the most recent is their default. */
    lastActiveAt: integer("last_active_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.userId] }),
    index("workspace_members_user_id_idx").on(table.userId),
  ]
);

/**
 * An invitation to join a workspace. Only the SHA-256 hash of the link's token is stored
 * (pattern from Better Auth's organization plugin, MIT: hashed tokens, expiry).
 */
export const workspaceInvitations = sqliteTable(
  "workspace_invitations",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    invitedBy: text("invited_by").references(() => user.id, {
      onDelete: "set null",
    }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    acceptedAt: integer("accepted_at", { mode: "timestamp_ms" }),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(now)
      .notNull(),
  },
  (table) => [
    index("workspace_invitations_email_idx").on(table.email),
    index("workspace_invitations_workspace_id_idx").on(table.workspaceId),
  ]
);
