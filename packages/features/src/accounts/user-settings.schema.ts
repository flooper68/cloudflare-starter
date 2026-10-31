import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./accounts.schema";

/** Personal preferences and the current custom avatar, independent of workspace membership. */
export const userSettings = sqliteTable(
  "user_settings",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    theme: text("theme", { enum: ["system", "light", "dark"] })
      .notNull()
      .default("system"),
    timezone: text("timezone").notNull().default("UTC"),
    locale: text("locale").notNull().default("en"),
    avatarKey: text("avatar_key"),
  },
  (table) => [index("user_settings_avatar_key_idx").on(table.avatarKey)]
);
