import { signInQaAdmin } from "./support/admin";
import {
  expect,
  newQaAccount,
  newUserPage,
  type Page,
  skipWithoutQaEnv,
  test,
} from "./support/journey";
import {
  type Account,
  AUTH_WAIT,
  createWorkspace,
  displayName,
  open,
  signInAs,
  submitSignIn,
} from "./support/session";

// Checklist: Admin portal, and Billing's admin override. As the self-provisioned QA admin
// (support/admin.ts), acting only on this run's own account T and T's workspace.
// Read-only on everything else: no flag, setting or other account changes.
skipWithoutQaEnv();
test.describe.configure({ mode: "serial" });

let admin: Page;
let target: Page;
let account: Account;
let targetName: string;
const reason = `QA ${process.env.QA_RUN_ID ?? "run"}`;
const workspace = `QA ${process.env.QA_RUN_ID ?? "run"} admin`;

test.beforeAll(async ({ browser }) => {
  admin = await newUserPage(browser);
  target = await newUserPage(browser);
  await signInQaAdmin(admin);
  account = {
    ...(await newQaAccount(target, { role: "admintarget" })),
  };
  targetName = await displayName(target);
  await createWorkspace(target, workspace);
});

test.afterAll(async () => {
  await admin?.context().close();
  await target?.context().close();
});

async function openTarget() {
  await open(admin, "/admin/users");
  await admin
    .getByRole("searchbox", { name: "Search users" })
    .fill(account.email);
  await admin.getByText(account.email).click();
  await expect(admin.getByRole("heading", { name: targetName })).toBeVisible();
}

test("overview: counts and the health card", async () => {
  await open(admin, "/admin/overview");
  await expect(admin.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(admin.getByText(/health/i).first()).toBeVisible();
  await expect(admin.getByText(/fail/i)).toHaveCount(0);
});

test("users: the run's account with its sign-in methods, workspaces and sessions, no tokens", async () => {
  await openTarget();
  const page = admin.locator("main");
  await expect(page).toContainText(/Email and password|password/i);
  await expect(page).toContainText(/Workspaces/);
  await expect(page).toContainText(/Sessions/);
  expect((await page.textContent()) ?? "").not.toMatch(
    /[A-Za-z0-9_-]{32,}\.[A-Za-z0-9_-]{20,}/
  );
});

test("suspending ends T's session and refuses sign-in; lifting it lets T in again", async ({
  browser,
}) => {
  await openTarget();
  await admin.getByRole("button", { name: "Suspend" }).click();
  const dialog = admin.getByRole("dialog", { name: `Suspend ${targetName}?` });
  await dialog.getByLabel("Reason").fill(reason);
  await dialog.getByRole("button", { name: "Suspend" }).click();
  await expect(admin.getByText(`${targetName} is suspended`)).toBeVisible();

  // T's open session ends: at once on the server, and in T's browser once the session
  // cookie cache (a minute, apps/web/src/server/auth.ts) runs out.
  await expect(async () => {
    await target.goto("/app/dashboard");
    await expect(target).toHaveURL(/\/sign-in/, { timeout: 1_000 });
  }).toPass({ timeout: 90_000, intervals: [5_000] });
  const fresh = await newUserPage(browser);
  try {
    await submitSignIn(fresh, account.email, account.password);
    await expect(fresh.getByText(/suspended/i)).toBeVisible({
      timeout: AUTH_WAIT,
    });
  } finally {
    await fresh.context().close();
  }

  await openTarget();
  await admin.getByRole("button", { name: "Lift suspension" }).click();
  await expect(
    admin.getByText(`${targetName} can sign in again`)
  ).toBeVisible();
  await signInAs(target, account);
});

test("impersonating T shows the banner; stopping returns to the admin", async () => {
  await openTarget();
  await admin.getByRole("button", { name: "Impersonate" }).click();
  await admin
    .getByRole("alertdialog", { name: `Impersonate ${targetName}?` })
    .getByRole("button", { name: "Impersonate" })
    .click();
  await expect(admin).toHaveURL(/\/app\/dashboard$/);
  await expect(
    admin.getByText(`You are signed in as ${targetName} (${account.email})`)
  ).toBeVisible();
  await expect(
    admin.getByRole("link", { name: "Admin", exact: true })
  ).toHaveCount(0);
  await admin.getByRole("button", { name: "Stop impersonating" }).click();
  await expect(admin).toHaveURL(/\/admin\/users\//);
  await expect(admin.getByText(/You are signed in as/)).toHaveCount(0);
});

test("billing: a plan, an add-on and a 1 MB storage override show on T's billing page, then are undone", async () => {
  await open(target, "/app/billing");
  const before = target.locator("main");
  await expect(
    before.getByText("Your admin manages this workspace's plan.")
  ).toBeVisible();

  await open(admin, "/admin/workspaces");
  await admin
    .getByRole("searchbox", { name: "Search workspaces" })
    .fill(workspace);
  await admin.getByText(workspace, { exact: true }).click();
  await expect(
    admin.getByRole("heading", { name: "Billing", exact: true })
  ).toBeVisible();
  await expect(admin.getByText("Manual billing")).toBeVisible();

  // A plan: from the trial's plan to Free (active), then back to a trial of the original.
  const assign = admin.getByRole("form", { name: "Assign plan" });
  const planSelect = assign.getByRole("combobox", { name: "Plan" });
  const original = ((await planSelect.textContent()) ?? "").trim();
  const other = original === "Free" ? "Pro" : "Free";
  await planSelect.click();
  await admin.getByRole("option", { name: other, exact: true }).click();
  await assign.getByRole("combobox", { name: "Status" }).click();
  await admin.getByRole("option", { name: "Active", exact: true }).click();
  await assign.getByRole("button", { name: "Assign plan" }).click();
  await expect(admin.getByText("Plan assigned").first()).toBeVisible();
  await open(target, "/app/billing");
  await expect(target.locator("main")).toContainText(other);

  // An add-on, listed on the owner's plan card.
  const addons = admin.getByRole("form", { name: "Add-ons" });
  const seats = addons.getByLabel("5 more seats");
  await seats.fill("1");
  await addons.getByRole("button", { name: "Save add-ons" }).click();
  await expect(admin.getByText("Add-ons saved").first()).toBeVisible();
  await open(target, "/app/billing");
  await expect(target.locator("main")).toContainText("5 more seats × 1");
  await seats.fill("0");
  await addons.getByRole("button", { name: "Save add-ons" }).click();
  await expect(admin.getByText("Add-ons saved").first()).toBeVisible();

  await planSelect.click();
  await admin.getByRole("option", { name: original, exact: true }).click();
  await assign.getByRole("combobox", { name: "Status" }).click();
  await admin.getByRole("option", { name: "Trial", exact: true }).click();
  const trialEnds = new Date(Date.now() + 14 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  await assign.getByLabel("Trial ends (UTC)").fill(trialEnds);
  await assign.getByRole("button", { name: "Assign plan" }).click();
  await expect(admin.getByText("Plan assigned").first()).toBeVisible();
  await open(target, "/app/billing");
  await expect(target.locator("main")).toContainText(original);
  await expect(target.getByText(/trial/i).first()).toBeVisible();

  const override = admin.getByRole("form", { name: "Override" });
  await override.getByLabel("Limit (MB)").fill("1");
  await override.getByLabel("Reason").fill(reason);
  await override.getByRole("button", { name: "Set override" }).click();
  await expect(admin.getByText("Override set")).toBeVisible();
  await expect(
    admin.getByRole("list", { name: "Current overrides" })
  ).toContainText("1 MB");

  await open(target, "/app/billing");
  await expect(target.getByText("Override").first()).toBeVisible();

  await override.getByLabel("Reason").fill(`${reason} done`);
  await override.getByRole("button", { name: "Remove override" }).click();
  await expect(admin.getByText("Override removed")).toBeVisible();
  await expect(admin.getByText("No overrides.")).toBeVisible();
});

test("audit log: the suspension and the impersonation of the run", async () => {
  await open(admin, "/admin/audit");
  await expect(admin.getByRole("heading", { name: "Audit log" })).toBeVisible();
  await expect(admin.getByText("user.banned").first()).toBeVisible();
  await expect(admin.getByText("user.unbanned").first()).toBeVisible();
  await expect(admin.getByText("impersonation.started").first()).toBeVisible();
  await expect(admin.getByText(/billing\./).first()).toBeVisible();
});

test("flags, workspaces, data requests and settings open, read-only", async () => {
  await open(admin, "/admin/flags");
  await expect(
    admin.getByRole("heading", { name: "Feature flags" })
  ).toBeVisible();
  await open(admin, "/admin/workspaces");
  await expect(
    admin.getByRole("heading", { name: "Workspaces" })
  ).toBeVisible();
  await open(admin, "/admin/data-requests");
  await expect(
    admin.getByRole("heading", { name: "Data requests" })
  ).toBeVisible();
  await open(admin, "/admin/settings");
  await expect(admin.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(admin.locator("main")).toContainText(/BILLING|manual/);
});
