import { z } from "zod";

/**
 * The flag catalog: every feature flag the code may evaluate, with its type, default,
 * owner and the condition for removing it. A flag is a temporary release or operations
 * switch, never a paid entitlement or a permission (docs/guides/how-to-use-feature-flags.md).
 *
 * Rules (test/architecture/feature-flags.test.ts): every key evaluated anywhere is listed
 * here, every entry is used somewhere, every entry has an owner and a removal condition,
 * keys are string literals at the call site.
 */
export const FLAGS = {
  "upload-demo-presigned": {
    type: "boolean",
    default: true,
    owner: "platform",
    removeWhen:
      "the upload demo keeps a single upload path, or both paths are kept for good",
    rolloutBy: "workspace",
    client: true,
    description:
      "Shows the presigned (browser to R2) upload card next to the Worker upload on the upload demo page.",
  },
} as const satisfies Record<string, FlagDefinition>;

export type FlagType = "boolean" | "string" | "number";

/** Which id a percentage rollout buckets by. */
export type FlagRolloutBy = "workspace" | "user";

interface FlagDefinitionBase {
  /** Team or person who removes the flag. */
  readonly owner: string;
  /** When the flag is deleted from the code, e.g. "100 % for two weeks without incidents". */
  readonly removeWhen: string;
  readonly rolloutBy: FlagRolloutBy;
  /** Sent to the browser by `flags.client` (read with useFlag / FlagGate). */
  readonly client: boolean;
  readonly description: string;
}

export type FlagDefinition = FlagDefinitionBase &
  (
    | { readonly type: "boolean"; readonly default: boolean }
    | { readonly type: "string"; readonly default: string }
    | { readonly type: "number"; readonly default: number }
  );

export type FlagKey = keyof typeof FLAGS;

type ValueOfType<T> = T extends "boolean"
  ? boolean
  : T extends "string"
    ? string
    : T extends "number"
      ? number
      : never;

/** The value type of a catalog flag. */
export type FlagValueOf<K extends FlagKey> = ValueOfType<
  (typeof FLAGS)[K]["type"]
>;

/** Keys of the flags the browser may read. */
export type ClientFlagKey = {
  [K in FlagKey]: (typeof FLAGS)[K]["client"] extends true ? K : never;
}[FlagKey];

/** The evaluated client flags, as `flags.client` returns them. */
export type ClientFlags = { readonly [K in ClientFlagKey]: FlagValueOf<K> };

/** Kebab-case, as the keys appear in code, the database and vendor dashboards. */
export const FLAG_KEY_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

const base = {
  owner: z.string().trim().min(1),
  removeWhen: z.string().trim().min(10),
  rolloutBy: z.enum(["workspace", "user"]),
  client: z.boolean(),
  description: z.string().trim().min(10),
};

/** Shape every catalog entry must have (checked by the catalog's test). */
export const flagDefinitionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("boolean"), default: z.boolean(), ...base }),
  z.object({ type: z.literal("string"), default: z.string(), ...base }),
  z.object({ type: z.literal("number"), default: z.number(), ...base }),
]);

/** The catalog entry of a key, or undefined for a key the catalog does not list. */
export function findFlagDefinition(
  key: string
): (FlagDefinition & { readonly key: FlagKey }) | undefined {
  if (!Object.hasOwn(FLAGS, key)) return undefined;
  const flagKey = key as FlagKey;
  return { key: flagKey, ...(FLAGS[flagKey] as FlagDefinition) };
}
