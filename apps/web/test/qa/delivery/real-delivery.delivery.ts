/**
 * Weekly: one real mail through the deployed app's real sending path, to a real inbox
 * (CI workflow `QA`, job `delivery`). The QA outbox keeps the suite's own mail, so this is
 * what still exercises Cloudflare Email Service, the sender domain and its DNS.
 *
 * As the QA admin (QA_ADMIN_EMAIL, a `qa+…@` address the QA bypass covers), it asks the
 * admin portal's API to send the delivery account (QA_DELIVERY_ADDRESS, the owner's own
 * address, signed up once) a password reset mail: `admin.users.sendPasswordReset`, the
 * portal's existing "Send password reset". The link expires unused. It asserts only that
 * the app accepted and sent it; whether it reached the inbox (and not spam) a person
 * checks when needed. docs/guides/how-to-qa-a-deployment.md#weekly-delivery-check
 */
import { callApp, open, qaSkipReason, qaTest, signIn } from "../support";

const adminEmail = process.env.QA_ADMIN_EMAIL?.trim().toLowerCase() ?? "";
const adminPassword = process.env.QA_ADMIN_PASSWORD ?? "";
const deliveryAddress =
  process.env.QA_DELIVERY_ADDRESS?.trim().toLowerCase() ?? "";
const missing = [
  ["QA_ADMIN_EMAIL", adminEmail],
  ["QA_ADMIN_PASSWORD", adminPassword],
  ["QA_DELIVERY_ADDRESS", deliveryAddress],
]
  .filter(([, value]) => !value)
  .map(([name]) => name);
const skip =
  qaSkipReason() ??
  (missing.length
    ? `Delivery check skipped: set ${missing.join(", ")} (docs/guides/how-to-qa-a-deployment.md#weekly-delivery-check)`
    : null);

qaTest.skip(skip !== null, skip ?? "");

interface UserPage {
  readonly items: readonly { readonly id: string; readonly email: string }[];
}

qaTest(
  "one real mail leaves through the production sender",
  async ({ page }) => {
    if (
      deliveryAddress.endsWith(
        `@${process.env.QA_EMAIL_DOMAIN ?? "qa.flooper.me"}`
      )
    ) {
      throw new Error(
        "QA_DELIVERY_ADDRESS must be a real mailbox outside the QA domain: mail to the QA domain stays in the QA outbox"
      );
    }
    await signIn(page, { email: adminEmail, password: adminPassword });
    await open(page, "/admin/overview");
    const { items } = await callApp<UserPage>(
      page,
      "query",
      "admin.users.list",
      {
        search: deliveryAddress,
        limit: 10,
      }
    );
    const user = items.find(
      (row) => row.email.toLowerCase() === deliveryAddress
    );
    if (!user) {
      throw new Error(
        "QA_DELIVERY_ADDRESS has no account on this deployment: sign it up once in a browser"
      );
    }
    const sent = await callApp<{ readonly email: string }>(
      page,
      "mutation",
      "admin.users.sendPasswordReset",
      { userId: user.id }
    );
    if (sent.email.toLowerCase() !== deliveryAddress) {
      throw new Error(
        "the reset went to another address than QA_DELIVERY_ADDRESS"
      );
    }
    console.log(
      "Delivery check: the app sent one real mail to QA_DELIVERY_ADDRESS (inbox placement is checked by a person when needed)."
    );
  }
);
