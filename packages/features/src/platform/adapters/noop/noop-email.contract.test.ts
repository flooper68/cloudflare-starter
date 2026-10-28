import { describeEmailContract } from "../../ports/email.contract";
import { noopEmail } from "./noop-email";

describeEmailContract("noopEmail", () => ({
  email: noopEmail,
  delivers: false,
  delivered: () => [],
}));
