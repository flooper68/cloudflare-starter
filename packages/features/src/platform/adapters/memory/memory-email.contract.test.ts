import { describeEmailContract } from "../../ports/email.contract";
import { createMemoryEmail } from "./memory-email";

describeEmailContract("createMemoryEmail", () => {
  const email = createMemoryEmail();
  return { email, delivers: true, delivered: () => email.sent };
});
