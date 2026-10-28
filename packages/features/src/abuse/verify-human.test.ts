import { describe, expect, it } from "vitest";

import {
  createMemoryHumanVerifier,
  type HumanVerificationFailure,
} from "../platform";
import { HumanCheckFailedError, HumanCheckUnavailableError } from "./domain";
import { verifyHuman } from "./verify-human";

const input = { remoteIp: "203.0.113.7", action: "sign-up" };
const verifier = createMemoryHumanVerifier({ passToken: "human" });

describe("verifyHuman", () => {
  it("passes a valid token", async () => {
    await expect(
      verifyHuman({ humanVerifier: verifier }, { ...input, token: "human" })
    ).resolves.toBeUndefined();
  });

  it("throws HumanCheckFailedError for a missing or rejected token and says why", async () => {
    const reasons: HumanVerificationFailure[] = [];
    const deps = {
      humanVerifier: verifier,
      onFailure: async (reason: HumanVerificationFailure) => {
        reasons.push(reason);
      },
    };
    await expect(
      verifyHuman(deps, { ...input, token: null })
    ).rejects.toBeInstanceOf(HumanCheckFailedError);
    await expect(
      verifyHuman(deps, { ...input, token: "bot" })
    ).rejects.toBeInstanceOf(HumanCheckFailedError);
    expect(reasons).toEqual(["missing", "rejected"]);
  });

  it("throws HumanCheckUnavailableError when the provider cannot answer", async () => {
    await expect(
      verifyHuman(
        {
          humanVerifier: {
            verify: async () => ({ ok: false, reason: "unavailable" }),
          },
        },
        { ...input, token: "human" }
      )
    ).rejects.toBeInstanceOf(HumanCheckUnavailableError);
  });
});
