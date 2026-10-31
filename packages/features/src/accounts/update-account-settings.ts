import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import { type AccountSettingsInput, accountSettingsSchema } from "./domain";
import { getAccountSettings } from "./get-account-settings";
import { userSettings } from "./user-settings.schema";

/** Updates only the authenticated user's preferences; avatar references are preserved. */
export async function updateAccountSettings(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
  },
  input: { readonly userId: string; readonly settings: AccountSettingsInput }
) {
  const settings = accountSettingsSchema.parse(input.settings);
  await deps.db
    .insert(userSettings)
    .values({ userId: input.userId, ...settings })
    .onConflictDoUpdate({ target: userSettings.userId, set: settings });
  await recordAuditEvent(deps, deps.requestContext, {
    action: "account.settings_updated",
    actor: { kind: "user", userId: input.userId },
    target: { type: "user", id: input.userId },
  });
  return getAccountSettings(deps, input);
}
