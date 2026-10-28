import type { HumanVerifier } from "../../ports";

/** HumanVerifier that passes everyone (TURNSTILE=off). */
export const noopHumanVerifier: HumanVerifier = {
  verify: async () => ({ ok: true }),
};
