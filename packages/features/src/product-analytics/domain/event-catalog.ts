import type { AnalyticsEventDefinition } from "../../kernel";
import { eventDefinitionProblems } from "./event-rules";

/** Every product event the app may send, by name. */
export type AnalyticsEventCatalog = ReadonlyMap<
  string,
  AnalyticsEventDefinition
>;

/**
 * Builds the catalog; throws on a malformed definition or a duplicate name, so a bad
 * catalog fails at startup and in tests.
 */
export function createEventCatalog(
  definitions: readonly AnalyticsEventDefinition[]
): AnalyticsEventCatalog {
  const catalog = new Map<string, AnalyticsEventDefinition>();
  for (const definition of definitions) {
    const problems = eventDefinitionProblems(definition);
    if (problems.length) throw new Error(problems.join("; "));
    if (catalog.has(definition.name))
      throw new Error(`Analytics event "${definition.name}" is declared twice`);
    catalog.set(definition.name, definition);
  }
  return catalog;
}
