import {
  expect,
  newQaAccount,
  newUserPage,
  type Page,
  skipWithoutQaEnv,
  test,
} from "./support/journey";
import { expectMail } from "./support/mail";
import { open } from "./support/session";

// Checklist: Demos (queue and email). One account; the test email goes to its own QA
// address (the demo sends to the signed-in address only).
skipWithoutQaEnv();
test.describe.configure({ mode: "serial" });

let page: Page;
let email: string;

test.beforeAll(async ({ browser }) => {
  page = await newUserPage(browser);
  ({ email } = await newQaAccount(page, { role: "demos" }));
});

test.afterAll(async () => {
  await page?.context().close();
});

test("Developer demos lists Upload, Queue and Email", async () => {
  await open(page, "/app/demos");
  await expect(
    page.getByRole("heading", { name: "Developer demos" })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open upload demo" })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open queue demo" })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open email demo" })
  ).toBeVisible();
});

test("the queue demo enqueues a hello job", async () => {
  await open(page, "/app/queue-demo");
  await page.getByRole("button", { name: "Queue hello" }).click();
  await expect(
    page.getByText(
      "Queued successfully. Check the queue worker logs for output."
    )
  ).toBeVisible();
});

test("the email demo sends the test email to the signed-in QA address", async () => {
  await open(page, "/app/email-demo");
  const since = new Date();
  await page.getByRole("button", { name: "Send test email" }).click();
  await expect(page.getByText(/^Email sent\./)).toBeVisible();
  await expectMail(
    email,
    /^\[[a-z]+\] Starter kit test email$/,
    since,
    false,
    "Starter kit test email"
  );
});
