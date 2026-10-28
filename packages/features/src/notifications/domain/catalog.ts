import type { NotificationDefinition } from "../../kernel";
import { UnknownNotificationTypeError } from "./errors";

/** `<feature>.<name>`, lowercase kebab-case segments: `workspaces.member-joined`. */
export const NOTIFICATION_TYPE_PATTERN = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/;

/** Every notification type the app sends, by type, in catalog order. */
export type NotificationCatalog = ReadonlyMap<
  string,
  NotificationDefinition<unknown>
>;

/**
 * Builds the catalog; throws on a malformed or duplicate type, so a bad catalog fails at
 * startup and in tests.
 */
export function createNotificationCatalog(
  definitions: readonly NotificationDefinition<unknown>[]
): NotificationCatalog {
  const catalog = new Map<string, NotificationDefinition<unknown>>();
  for (const definition of definitions) {
    if (!NOTIFICATION_TYPE_PATTERN.test(definition.type)) {
      throw new Error(
        `Notification type "${definition.type}" must be <feature>.<name> in lowercase kebab-case`
      );
    }
    if (catalog.has(definition.type)) {
      throw new Error(`Notification type "${definition.type}" is listed twice`);
    }
    catalog.set(definition.type, definition);
  }
  return catalog;
}

/** The definition of `type`; throws UnknownNotificationTypeError (permanent) when absent. */
export function findNotification(
  catalog: NotificationCatalog,
  type: string
): NotificationDefinition<unknown> {
  const definition = catalog.get(type);
  if (!definition) throw new UnknownNotificationTypeError(type);
  return definition;
}
