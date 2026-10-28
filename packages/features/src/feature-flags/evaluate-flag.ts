import type { FeatureFlags, FlagDetails } from "../platform";
import {
  FLAGS,
  type FlagDefinition,
  type FlagKey,
  type FlagSubject,
  type FlagValueOf,
  flagContextFor,
} from "./domain";

/**
 * Evaluates a catalog flag for a subject. The only way features read a flag: the type,
 * default and rollout id come from the catalog, so a call cannot ask for the wrong type or
 * invent a default. Pass the key as a string literal (lint rule flag-key-literal). Never
 * throws: a provider failure resolves to the catalog default with reason ERROR.
 */
export async function evaluateFlag<K extends FlagKey>(
  flags: FeatureFlags,
  key: K,
  subject: FlagSubject
): Promise<FlagDetails<FlagValueOf<K>>> {
  const definition = FLAGS[key] as FlagDefinition;
  const context = flagContextFor(definition.rolloutBy, subject);
  switch (definition.type) {
    case "boolean":
      return (await flags.getBooleanDetails(
        key,
        definition.default,
        context
      )) as FlagDetails<FlagValueOf<K>>;
    case "string":
      return (await flags.getStringDetails(
        key,
        definition.default,
        context
      )) as FlagDetails<FlagValueOf<K>>;
    case "number":
      return (await flags.getNumberDetails(
        key,
        definition.default,
        context
      )) as FlagDetails<FlagValueOf<K>>;
  }
}
