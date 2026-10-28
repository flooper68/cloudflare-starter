import {
  ANALYTICS_EVENT_NAME,
  ANALYTICS_LIMITS,
  type AnalyticsEventDefinition,
  type AnalyticsEventLayout,
} from "../../kernel";

/**
 * Property names that suggest personal data. Strict on purpose: a property that matches
 * is renamed (or dropped), never exempted. Events carry categories, counts and buckets;
 * who did it travels only as the pseudonymous user and workspace keys.
 */
export const PERSONAL_DATA_PROPERTY =
  /email|e_?mail|phone|name$|first|last|address|ip|user_?id|ssn|birth|password|token|lat|lng|location/i;

/** Lowercase snake case, like the event names. */
const PROPERTY_NAME = /^[a-z][a-z0-9_]*$/;

/** Problems with a property layout: names, personal data, duplicates, slot limits. */
export function layoutProblems(layout: AnalyticsEventLayout): string[] {
  const problems: string[] = [];
  const names = [...layout.strings, ...layout.numbers];
  for (const name of names) {
    if (!PROPERTY_NAME.test(name))
      problems.push(`property "${name}" is not lowercase snake case`);
    if (PERSONAL_DATA_PROPERTY.test(name))
      problems.push(
        `property "${name}" looks like personal data: rename it (or drop it)`
      );
  }
  const duplicates = names.filter((name, i) => names.indexOf(name) !== i);
  if (duplicates.length)
    problems.push(`properties listed twice: ${duplicates.join(", ")}`);
  if (layout.strings.length > ANALYTICS_LIMITS.strings)
    problems.push(
      `${layout.strings.length} string properties (at most ${ANALYTICS_LIMITS.strings})`
    );
  if (layout.numbers.length > ANALYTICS_LIMITS.numbers)
    problems.push(
      `${layout.numbers.length} numeric properties (at most ${ANALYTICS_LIMITS.numbers})`
    );
  return problems;
}

/** Keys of a zod object schema, or null when the schema is not one. */
function schemaKeys(schema: unknown): string[] | null {
  const shape = (schema as { shape?: unknown }).shape;
  return shape && typeof shape === "object" ? Object.keys(shape).sort() : null;
}

/**
 * Everything wrong with an event definition, empty when it may join the catalog: the name
 * pattern and length, the layout rules, and a layout that lists exactly the schema's keys.
 */
export function eventDefinitionProblems(
  definition: AnalyticsEventDefinition
): string[] {
  const problems: string[] = [];
  if (!ANALYTICS_EVENT_NAME.test(definition.name))
    problems.push(
      `name "${definition.name}" is not <feature>.<object>_<verb> in lowercase snake case`
    );
  if (definition.name.length > ANALYTICS_LIMITS.nameLength)
    problems.push(
      `name is longer than ${ANALYTICS_LIMITS.nameLength} characters`
    );
  problems.push(...layoutProblems(definition.layout));
  const keys = schemaKeys(definition.properties);
  const listed = [
    ...definition.layout.strings,
    ...definition.layout.numbers,
  ].sort();
  if (keys && keys.join() !== listed.join())
    problems.push(
      `layout lists ${listed.join(", ") || "nothing"} but the schema has ${keys.join(", ") || "nothing"}`
    );
  if (!definition.description.trim()) problems.push("description is empty");
  return problems.map((problem) => `${definition.name}: ${problem}`);
}
