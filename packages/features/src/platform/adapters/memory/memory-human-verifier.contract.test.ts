import { describeHumanVerifierContract } from "../../ports/human-verifier.contract";
import { createMemoryHumanVerifier } from "./memory-human-verifier";

describeHumanVerifierContract("memory", () => ({
  verifier: createMemoryHumanVerifier({ passToken: "human-token" }),
  passToken: "human-token",
  failToken: "bot-token",
  enforces: true,
}));
