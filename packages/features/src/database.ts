// Composition root for the database: every feature's tables in one Drizzle schema.
// The only module allowed to import feature internals (their *.schema.ts files).
// Use cases import the Database type from here with `import type`.

import * as accountsSchema from "./accounts/accounts.schema";
import * as userSettingsSchema from "./accounts/user-settings.schema";
import * as auditSchema from "./audit/audit.schema";
import * as billingSchema from "./billing/billing.schema";
import * as filesSchema from "./files/files.schema";
import * as jobsSchema from "./jobs/jobs.schema";
import * as notificationsSchema from "./notifications/notifications.schema";
import { createDb, type Db } from "./platform";
import * as privacySchema from "./privacy/privacy.schema";
import * as workspacesSchema from "./workspaces/workspaces.schema";

export const schema = {
  ...privacySchema,
  ...accountsSchema,
  ...userSettingsSchema,
  ...auditSchema,
  ...billingSchema,
  ...filesSchema,
  ...jobsSchema,
  ...notificationsSchema,
  ...workspacesSchema,
};

export type Database = Db<typeof schema>;

/** The app's Drizzle client over the D1 binding (`env.DB`). */
export function createDatabase(d1: D1Database): Database {
  return createDb(d1, schema);
}
