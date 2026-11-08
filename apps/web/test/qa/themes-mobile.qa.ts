import { createVerifiedAccount } from "./support";
import { QA_ADMIN_SKIP, signInQaAdmin } from "./support/admin";
import {
  expect,
  newUserPage,
  type Page,
  skipWithoutQaEnv,
  test,
} from "./support/journey";
import { capture, setLook, type Theme, type Viewport } from "./support/screens";
import { open } from "./support/session";

// Checklist: Themes and mobile width, as a screenshot pass for the design-match review.
// Every main screen at 1440 and 390 px in the dark theme; the light theme only on the
// screens the checklist names for it (landing, sign-in, dashboard, members, settings,
// admin overview). Each capture is in the HTML report as
// `<section>-<screen>-<viewport>-<theme>.png`, and fails if the page scrolls sideways.
// One account (plus the QA admin for the admin overview, skipped without it).
skipWithoutQaEnv();
test.describe.configure({ mode: "serial" });

interface Screen {
  readonly section: string;
  readonly screen: string;
  readonly path: string;
  /** Captured in the light theme too. */
  readonly light?: boolean;
}

const PUBLIC: readonly Screen[] = [
  { section: "public", screen: "landing", path: "/", light: true },
  { section: "public", screen: "sign-in", path: "/sign-in", light: true },
  { section: "public", screen: "sign-up", path: "/sign-up" },
  { section: "public", screen: "forgot-password", path: "/forgot-password" },
];

const APP: readonly Screen[] = [
  { section: "app", screen: "dashboard", path: "/app/dashboard", light: true },
  { section: "app", screen: "members", path: "/app/members", light: true },
  { section: "app", screen: "notifications", path: "/app/notifications" },
  { section: "app", screen: "billing", path: "/app/billing" },
  { section: "app", screen: "upload", path: "/app/upload-demo" },
  { section: "app", screen: "trash", path: "/app/trash" },
  { section: "app", screen: "notes", path: "/app/notes" },
  { section: "app", screen: "tasks", path: "/app/tasks" },
  { section: "app", screen: "demos", path: "/app/demos" },
  { section: "app", screen: "not-found", path: "/app/no-such-page" },
  {
    section: "settings",
    screen: "account",
    path: "/app/settings/account",
    light: true,
  },
  { section: "settings", screen: "security", path: "/app/settings/security" },
  {
    section: "settings",
    screen: "appearance",
    path: "/app/settings/appearance",
  },
  { section: "settings", screen: "privacy", path: "/app/settings/privacy" },
  {
    section: "settings",
    screen: "connected-agents",
    path: "/app/settings/connected-agents",
  },
];

const LOOKS: readonly {
  viewport: Viewport;
  theme: Theme;
  lightOnly: boolean;
}[] = [
  { viewport: "1440", theme: "dark", lightOnly: false },
  { viewport: "390", theme: "dark", lightOnly: false },
  { viewport: "1440", theme: "light", lightOnly: true },
  { viewport: "390", theme: "light", lightOnly: true },
];

let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await newUserPage(browser);
  await createVerifiedAccount(page, { role: "screens" });
});

test.afterAll(async () => {
  await page?.context().close();
});

async function pass(
  target: Page,
  screens: readonly Screen[],
  testInfo: Parameters<typeof capture>[1]
) {
  for (const look of LOOKS) {
    await setLook(target, look.viewport, look.theme);
    for (const screen of screens) {
      if (look.lightOnly && !screen.light) continue;
      await open(target, screen.path);
      await expect(target.locator("main").first()).toBeVisible();
      await capture(target, testInfo, { ...screen, ...look });
    }
  }
}

test("public screens", async ({ browser }, testInfo) => {
  const signedOut = await newUserPage(browser);
  try {
    await pass(signedOut, PUBLIC, testInfo);
  } finally {
    await signedOut.context().close();
  }
});

// biome-ignore lint/correctness/noEmptyPattern: Playwright passes testInfo second
test("app and settings screens", async ({}, testInfo) => {
  await pass(page, APP, testInfo);
});

// biome-ignore lint/correctness/noEmptyPattern: Playwright passes testInfo second
test("the open command palette", async ({}, testInfo) => {
  for (const look of LOOKS.filter((l) => !l.lightOnly)) {
    await setLook(page, look.viewport, look.theme);
    await open(page, "/app/dashboard");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(
      page.getByRole("dialog", { name: "Search and jump" })
    ).toBeVisible();
    await capture(page, testInfo, {
      section: "app",
      screen: "palette",
      ...look,
    });
    await page.keyboard.press("Escape");
  }
});

test("admin overview", async ({ browser }, testInfo) => {
  const adminPage = await newUserPage(browser);
  try {
    const isAdmin = await signInQaAdmin(adminPage);
    test.skip(!isAdmin, QA_ADMIN_SKIP);
    await pass(
      adminPage,
      [
        {
          section: "admin",
          screen: "overview",
          path: "/admin/overview",
          light: true,
        },
      ],
      testInfo
    );
  } finally {
    await adminPage.context().close();
  }
});
