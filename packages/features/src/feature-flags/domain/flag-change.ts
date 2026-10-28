import { z } from "zod";

import { type FlagDefinition, findFlagDefinition } from "./catalog";
import { FlagValueTypeError, UnknownFlagError } from "./errors";

const value = z.union([z.boolean(), z.string().max(200), z.number()]);
const id = z.string().trim().min(1).max(100);

/** One targeting rule as an admin sends it; `percentageBp` is basis points (0–10000). */
export const flagRuleSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("workspace"), workspaceId: id, value }),
  z.object({ kind: z.literal("plan"), planId: id, value }),
  z.object({
    kind: z.literal("percentage"),
    percentageBp: z.number().int().min(0).max(10_000),
    value,
  }),
]);

export type FlagRuleInput = z.infer<typeof flagRuleSchema>;

/** Input of `admin.flags.update`: the switch and the value when no rule matches. */
export const flagUpdateSchema = z.object({
  key: z.string().min(1).max(100),
  enabled: z.boolean(),
  /** null: the catalog default. */
  fallthrough: value.nullable(),
});

/** Input of `admin.flags.setRules`: the full ordered rule list (replaces the old one). */
export const flagRulesSchema = z.object({
  key: z.string().min(1).max(100),
  rules: z.array(flagRuleSchema).max(50),
});

/** The catalog entry of `key`, or UnknownFlagError: only catalog flags can be configured. */
export function requireFlagDefinition(key: string): FlagDefinition {
  const definition = findFlagDefinition(key);
  if (!definition) throw new UnknownFlagError(key);
  return definition;
}

/** Rejects a configured value whose type is not the flag's catalog type. */
export function assertFlagValueType(
  key: string,
  definition: FlagDefinition,
  configured: boolean | string | number | null
): void {
  if (configured === null || typeof configured === definition.type) return;
  throw new FlagValueTypeError(key, definition.type, typeof configured);
}
