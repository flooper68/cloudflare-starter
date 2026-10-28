import { describe, expect, it } from "vitest";

import { createMemoryHumanVerifier } from "../platform";
import { HumanCheckFailedError, HumanCheckUnavailableError } from "./domain";
import { type HumanCheckFailure, verifyHuman } from "./verify-human";

const input = { remoteIp: "203.0.113.7", action: "sign-up" };
const verifier = createMemoryHumanVerifier({ passToken: "human" });

describe("verifyHuman", () => {
  it("passes a valid token", async () => {
    await expect(
      verifyHuman({ humanVerifier: verifier }, { ...input, token: "human" })
    ).resolves.toBeUndefined();
  });

  it("throws HumanCheckFailedError for a missing or rejected token and says why", async () => {
    const failures: HumanCheckFailure[] = [];
    const deps = {
      humanVerifier: verifier,
      onFailure: async (failure: HumanCheckFailure) => {
        failures.push(failure);
      },
    };
    await expect(
      verifyHuman(deps, { ...input, token: null })
    ).rejects.toBeInstanceOf(HumanCheckFailedError);
    await expect(
      verifyHuman(deps, { ...input, token: "bot" })
    ).rejects.toBeInstanceOf(HumanCheckFailedError);
    expect(failures).toEqual([{ reason: "missing" }, { reason: "rejected" }]);
  });

  it("throws HumanCheckUnavailableError when the provider cannot answer, passing the detail on", async () => {
    const failures: HumanCheckFailure[] = [];
    await expect(
      verifyHuman(
        {
          humanVerifier: {
            verify: async () => ({
              ok: false,
              reason: "unavailable",
              detail: "Siteverify did not answer after 2 attempts",
            }),
          },
          onFailure: async (failure) => {
            failures.push(failure);
          },
        },
        { ...input, token: "human" }
      )
    ).rejects.toBeInstanceOf(HumanCheckUnavailableError);
    expect(failures).toEqual([
      {
        reason: "unavailable",
        detail: "Siteverify did not answer after 2 attempts",
      },
    ]);
  });
});
