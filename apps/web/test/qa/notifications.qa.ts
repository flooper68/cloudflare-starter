import { inbox } from "./support";
import {
  expect,
  newQaAccount,
  newUserPage,
  type Page,
  skipWithoutQaEnv,
  test,
} from "./support/journey";
import { expectMail, unsubscribeUrl } from "./support/mail";
import {
  type Account,
  createWorkspace,
  displayName,
  open,
} from "./support/session";

// Checklist: Notifications (inbox, email, digest, unsubscribe). Two accounts: A owns a
// workspace and B joins it, which sends A "B joined …" (a notification with an
// unsubscribe link; security notices have none). A unsubscribes through the link's page;
// B through the RFC 8058 one-click POST of a role-change mail, and gets no mail after it.
// The digest goes out from the 08:00 UTC cron only, which a run cannot trigger on a
// deployment: that step is a documented skip.
skipWithoutQaEnv();
test.describe.configure({ mode: "serial" });

let a: Page;
let b: Page;
let accountA: Account;
let accountB: Account;
let nameA: string;
let nameB: string;
let joinedMail: Awaited<ReturnType<typeof expectMail>>;
const workspace = `QA ${process.env.QA_RUN_ID ?? "run"} notices`;
const joinedLabel = "Someone joins a workspace you manage";
const roleLabel = "Your role in a workspace changes";

test.beforeAll(async ({ browser }) => {
  a = await newUserPage(browser);
  b = await newUserPage(browser);
  accountA = { ...(await newQaAccount(a, { role: "notifowner" })) };
  accountB = { ...(await newQaAccount(b, { role: "notifmember" })) };
  nameA = await displayName(a);
  nameB = await displayName(b);
});

test.afterAll(async () => {
  await a?.context().close();
  await b?.context().close();
});

async function changeRoleOfB(role: "Owner" | "Member") {
  await open(a, "/app/members");
  const select = a
    .getByRole("table", { name: "Members" })
    .getByRole("combobox", { name: `Role of ${nameB}` });
  await select.click();
  await a.getByRole("option", { name: role, exact: true }).click();
  await expect(select).toHaveText(role);
}

test("B joining A's workspace sends A the notification mail with unsubscribe headers", async () => {
  await createWorkspace(a, workspace);
  await open(a, "/app/members");
  const invited = new Date();
  await a.getByRole("button", { name: "Invite people" }).click();
  const dialog = a.getByRole("dialog", { name: "Invite people" });
  await dialog.getByLabel("Email").fill(accountB.email);
  await dialog.getByRole("button", { name: "Send invitation" }).click();
  const invitation = await expectMail(
    accountB.email,
    `${nameA} invited you to ${workspace}`,
    invited,
    false
  );
  const link = invitation.links.find((href) => href.includes("/invite/"));
  const joined = new Date();
  await b.goto(link as string);
  await expect(b.locator("astro-island[ssr]")).toHaveCount(0);
  await b.getByRole("button", { name: "Accept and join" }).click();
  await expect(b).toHaveURL(/\/app\/dashboard$/);
  joinedMail = await expectMail(
    accountA.email,
    `${nameB} joined ${workspace}`,
    joined,
    true
  );
});

test("the bell: the badge counts the unread items; open, mark read and archive", async () => {
  const title = `${nameB} joined ${workspace}`;
  const badge = a.getByRole("button", { name: /^Notifications, \d+ unread$/ });
  await expect(async () => {
    await open(a, "/app/dashboard");
    await expect(badge).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 60_000 });
  const count = Number(
    /(\d+) unread/.exec((await badge.getAttribute("aria-label")) ?? "")?.[1]
  );
  await badge.click();
  const panel = a.getByRole("dialog", { name: "Notifications" });
  await panel.getByRole("radio", { name: "Unread" }).click();
  await expect(
    panel.getByRole("list", { name: "Notifications" }).getByRole("listitem")
  ).toHaveCount(count);
  await panel.getByRole("button", { name: `Mark read: ${title}` }).click();
  await expect(panel.getByRole("link", { name: title })).toBeHidden();
  await a.keyboard.press("Escape");
  await expect(
    count > 1
      ? a.getByRole("button", { name: `Notifications, ${count - 1} unread` })
      : a.getByRole("button", { name: "Notifications", exact: true })
  ).toBeVisible();

  // Opening it from the inbox page goes to its target; archiving moves it to Archived.
  await open(a, "/app/notifications");
  const list = a.getByRole("list", { name: "Notifications" });
  await list.getByRole("button", { name: `Archive: ${title}` }).click();
  await expect(list.getByRole("link", { name: title })).toHaveCount(0);
  await a.getByRole("radio", { name: "Archived" }).click();
  await list.getByRole("link", { name: title }).click();
  await expect(a).toHaveURL(/\/app\/members$/);
});

test("preferences: the daily digest can be chosen; a security notice cannot be turned off", async () => {
  await open(a, "/app/notifications/preferences");
  await expect(
    a.getByRole("switch", { name: "Your password changes: email" })
  ).toBeDisabled();
  await expect(
    a.getByRole("switch", { name: `${joinedLabel}: email` })
  ).toBeEnabled();
  await a.getByRole("radio", { name: "Daily digest" }).click();
  await expect(a.getByText("Preferences saved").first()).toBeVisible();
  await open(a, "/app/notifications/preferences");
  await expect(a.getByRole("radio", { name: "Daily digest" })).toBeChecked();
  // Back to each at once, so the rest of the run gets its mail.
  await a.getByRole("radio", { name: "Each at once" }).click();
  await expect(a.getByRole("radio", { name: "Each at once" })).toBeChecked();
});

test("the digest mail", async () => {
  test.skip(
    true,
    "the digest is sent by the daily 08:00 UTC cron only; a run cannot trigger it on a deployment (check the next day's mail by hand, how-to-qa-a-deployment.md)"
  );
});

test("the mail's unsubscribe link needs no sign-in and turns off only that type", async ({
  browser,
}) => {
  const signedOut = await newUserPage(browser);
  try {
    await signedOut.goto(unsubscribeUrl(joinedMail));
    await expect(signedOut).toHaveURL(/\/unsubscribe\?t=/);
    await expect(signedOut.locator("astro-island[ssr]")).toHaveCount(0);
    await expect(
      signedOut.getByRole("heading", { name: "Unsubscribe?" })
    ).toBeVisible();
    await signedOut.getByRole("button", { name: "Unsubscribe" }).click();
    await expect(signedOut.getByText("You are unsubscribed")).toBeVisible();
  } finally {
    await signedOut.context().close();
  }
  await open(a, "/app/notifications/preferences");
  await expect(
    a.getByRole("switch", { name: `${joinedLabel}: email` })
  ).not.toBeChecked();
  await expect(
    a.getByRole("switch", { name: `${joinedLabel}: in app` })
  ).toBeChecked();
  await expect(
    a.getByRole("switch", { name: `${roleLabel}: email` })
  ).toBeChecked();
});

test("one-click unsubscribe (RFC 8058 POST) from a role-change mail; no mail of that type after it", async ({
  playwright,
}) => {
  const since = new Date();
  await changeRoleOfB("Owner");
  const mail = await expectMail(
    accountB.email,
    `You are now Owner in ${workspace}`,
    since,
    true
  );
  // As a mail provider sends it: no cookies, no browser, the form body RFC 8058 requires.
  const client = await playwright.request.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const response = await client.post(unsubscribeUrl(mail), {
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-qa-token": process.env.QA_TOKEN ?? "",
    },
    data: "List-Unsubscribe=One-Click",
  });
  expect(response.status()).toBeLessThan(300);
  await client.dispose();
  await open(b, "/app/notifications/preferences");
  await expect(
    b.getByRole("switch", { name: `${roleLabel}: email` })
  ).not.toBeChecked();

  // The next role change still reaches B's inbox in the app, but sends no mail.
  const after = new Date();
  await changeRoleOfB("Member");
  await expect(async () => {
    await open(b, "/app/notifications");
    await expect(
      b.getByRole("list", { name: "Notifications" }).getByRole("link", {
        name: `You are now Member in ${workspace}`,
      })
    ).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 60_000 });
  const extra = await inbox
    .waitFor({
      to: accountB.email,
      subject: `You are now Member in ${workspace}`,
      since: after,
      timeoutMs: 15_000,
    })
    .catch(() => null);
  expect(extra, "a mail after unsubscribing").toBeNull();
});
