/**
 * Weekly: one real mail through the deployed app's real sending path to a real inbox (CI
 * workflow `QA`, job `delivery`). The QA outbox keeps the suite's own mail, so this is what
 * still exercises Cloudflare Email Service, the sender domain and its DNS.
 *
 * As the QA admin (self-provisioned, password derived from QA_TOKEN) it calls the admin
 * portal's "send test email" (`admin.email.sendTest`) for QA_DELIVERY_ADDRESS, a plain
 * workflow variable (the owner's own address, not a secret). It asserts only that the app
 * accepted and sent it; whether it reached the inbox (and not spam) a person checks there
 * when needed. docs/guides/how-to-qa-a-deployment.md#weekly-delivery-check
 */
import { callApp, open, qaEnv, qaSkipReason, qaTest, signIn } from "../support";
import { qaAdmin } from "../support/admin";

const deliveryAddress =
  process.env.QA_DELIVERY_ADDRESS?.trim().toLowerCase() ?? "";
const skip =
  qaSkipReason() ??
  (deliveryAddress
    ? null
    : "Delivery check skipped: set QA_DELIVERY_ADDRESS (docs/guides/how-to-qa-a-deployment.md#weekly-delivery-check)");

qaTest.skip(skip !== null, skip ?? "");

qaTest(
  "one real mail leaves through the production sender",
  async ({ page }) => {
    const env = qaEnv();
    if (deliveryAddress.endsWith(`@${env.emailDomain}`)) {
      throw new Error(
        "QA_DELIVERY_ADDRESS must be a real mailbox outside the QA domain: mail to the QA domain stays in the QA outbox"
      );
    }
    await signIn(page, qaAdmin(env));
    await open(page, "/admin/overview");
    const result = await callApp<{ readonly sent: boolean }>(
      page,
      "mutation",
      "admin.email.sendTest",
      { to: deliveryAddress }
    );
    if (!result.sent) throw new Error("the app did not send the test mail");
    console.log(
      "Delivery check: the app sent one real test mail to QA_DELIVERY_ADDRESS (inbox placement is checked by a person when needed)."
    );
  }
);
