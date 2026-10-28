import { describeHumanVerifierContract } from "../../ports/human-verifier.contract";
import { noopHumanVerifier } from "./noop-human-verifier";

describeHumanVerifierContract("noop", () => ({
  verifier: noopHumanVerifier,
  passToken: "anything",
  failToken: "anything else",
  enforces: false,
}));
