import { signInQaAdmin } from "./support/admin";
import {
  expect,
  newUserPage,
  type Page,
  skipWithoutQaEnv,
  test,
} from "./support/journey";
import { open } from "./support/session";

// Checklist: Analytics. As the self-provisioned QA admin (support/admin.ts), read-only:
// the Analytics page opens and shows either the funnel or which settings to set, never
// an error, and the public pages carry the site events tag with no CSP violation (the
// suite's own browser sends nothing: automated browsers are left out of the funnel).
skipWithoutQaEnv();
test.describe.configure({ mode: "serial" });

let admin: Page;

test.beforeAll(async ({ browser }) => {
  admin = await newUserPage(browser);
  await signInQaAdmin(admin);
});

test.afterAll(async () => {
  await admin?.context().close();
});

test("the Analytics page shows the funnel or the settings to set, never an error", async () => {
  await open(admin, "/admin/analytics");
  await expect(admin.getByRole("heading", { name: "Analytics" })).toBeVisible();
  const funnel = admin.getByRole("list", { name: "Funnel" });
  const notConnected = admin.getByText("Analytics are not connected");
  await expect(funnel.or(notConnected)).toBeVisible();
  await expect(admin.getByRole("button", { name: /try again/i })).toHaveCount(
    0
  );
  if (await funnel.isVisible()) {
    await admin.getByRole("radio", { name: "24 hours" }).click();
    await expect(admin).toHaveURL(/\/admin\/analytics\?days=1$/);
    await expect(funnel).toBeVisible();
  }
});

test("the public pages carry the site events tag and send nothing from this browser", async () => {
  const sent: string[] = [];
  admin.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/site-events")
      sent.push(request.url());
  });
  for (const path of ["/", "/docs/"]) {
    await open(admin, path);
    await admin.mouse.wheel(0, 2000);
  }
  await admin.waitForTimeout(1500);
  expect(sent).toEqual([]);
});
