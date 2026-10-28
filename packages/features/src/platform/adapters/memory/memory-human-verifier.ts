import type { HumanVerifier } from "../../ports";

/** HumanVerifier for tests: exactly `passToken` passes, anything else is rejected. */
export function createMemoryHumanVerifier(options: {
  readonly passToken: string;
}): HumanVerifier {
  return {
    async verify({ token }) {
      if (!token) return { ok: false, reason: "missing" };
      return token === options.passToken
        ? { ok: true }
        : { ok: false, reason: "rejected" };
    },
  };
}
