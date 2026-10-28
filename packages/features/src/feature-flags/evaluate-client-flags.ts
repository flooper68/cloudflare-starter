import type { FeatureFlags } from "../platform";
import {
  type ClientFlagKey,
  type ClientFlags,
  FLAGS,
  type FlagKey,
  type FlagSubject,
} from "./domain";
import { evaluateFlag } from "./evaluate-flag";

const CLIENT_FLAG_KEYS = (Object.keys(FLAGS) as FlagKey[]).filter(
  (key): key is ClientFlagKey => FLAGS[key].client
);

/**
 * The values of the flags marked `client: true`, for the browser. Only values leave the
 * server: no rules, reasons or other subjects' data. One provider load serves them all.
 */
export async function evaluateClientFlags(
  deps: { readonly flags: FeatureFlags },
  subject: FlagSubject
): Promise<ClientFlags> {
  const entries = await Promise.all(
    CLIENT_FLAG_KEYS.map(
      async (key) =>
        [key, (await evaluateFlag(deps.flags, key, subject)).value] as const
    )
  );
  return Object.fromEntries(entries) as ClientFlags;
}
