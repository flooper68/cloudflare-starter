/**
 * Every screen the docs show, captured by `bun run docs:screenshots` (capture.spec.ts)
 * into docs/images/screens/ in the dark and the light theme at 1440 × 900, and at phone
 * size where `phone` is set. A doc refers to a shot by its id
 * (`:::screenshot{shot="members"}`, `::shot{id="members"}`, `::video{poster="…"}`).
 *
 * `callouts` are element locators, in the order of the doc's numbered callout list: the
 * pipeline measures each element and stores its position with the image, so a marker
 * follows its element when the UI moves. Add a shot here, run the pipeline, commit the
 * images and the manifest. docs/guides/how-to-publish-docs-and-landing.md#screenshots
 */
import type { Locator, Page } from "@playwright/test";

import { agentConsent } from "../seed/demo";

export interface Shot {
  readonly id: string;
  /** App path to open (after `prepare`, if any, has run). */
  readonly path: string;
  readonly alt: string;
  /** Also capture at phone size (390 × 844). */
  readonly phone?: boolean;
  /** Capture signed out. */
  readonly signedOut?: boolean;
  /** The element that shows the page is ready. */
  readonly ready: (page: Page) => Locator;
  /** Opens a dialog or menu after the page is ready. */
  readonly prepare?: (page: Page) => Promise<void>;
  /** Replaces opening `path` (a flow that ends on the screen, e.g. the consent page). */
  readonly navigate?: (page: Page) => Promise<void>;
  readonly callouts?: (page: Page) => readonly Locator[];
}

const h2 = (name: string | RegExp) => (page: Page) =>
  page.getByRole("heading", { level: 2, name });

export const SHOTS: readonly Shot[] = [
  {
    id: "dashboard",
    path: "/app/dashboard",
    alt: "The dashboard of the sample workspace, with the getting-started checklist",
    phone: true,
    ready: (page) => page.getByRole("main"),
    callouts: (page) => [
      page.getByRole("button", { name: /workspace menu$/ }),
      page
        .getByRole("navigation")
        .getByRole("link", { name: "Notes", exact: true }),
    ],
  },
  {
    id: "notes",
    path: "/app/notes",
    alt: "Notes: the list of the workspace's notes",
    phone: true,
    ready: (page) => page.getByRole("listbox", { name: "Notes" }),
    callouts: (page) => [
      page.getByRole("button", { name: "New note" }).first(),
      page.getByLabel("Search notes"),
    ],
  },
  {
    id: "note-detail",
    path: "/app/notes",
    alt: "A note with its comment",
    ready: (page) => page.getByRole("listbox", { name: "Notes" }),
    prepare: async (page) => {
      await page
        .getByRole("listbox", { name: "Notes" })
        .getByRole("option", { name: /Q3 launch checklist/ })
        .click();
      await page.getByRole("textbox", { name: "Comment" }).waitFor();
    },
    callouts: (page) => [
      page.getByRole("button", { name: "Edit" }),
      page.getByRole("button", { name: "Move to trash" }),
      page.getByRole("textbox", { name: "Comment" }),
    ],
  },
  {
    id: "command-palette",
    path: "/app/dashboard",
    alt: "The command palette, searching for settings",
    ready: (page) => page.getByRole("main"),
    prepare: async (page) => {
      await page.keyboard.press("ControlOrMeta+k");
      const palette = page.getByRole("dialog", { name: "Search and jump" });
      await palette.getByRole("combobox").fill("set");
      await palette.getByRole("option").first().waitFor();
    },
    callouts: (page) => [
      page
        .getByRole("dialog", { name: "Search and jump" })
        .getByRole("combobox"),
      page
        .getByRole("dialog", { name: "Search and jump" })
        .getByRole("option")
        .first(),
    ],
  },
  {
    id: "connected-agents",
    path: "/app/settings/connected-agents",
    alt: "Settings › Connected agents, listing the demo MCP client",
    phone: true,
    ready: h2("Connected agents"),
    callouts: (page) => [
      page.getByRole("list", { name: /^What .* may do$/ }).first(),
      page.getByRole("button", { name: /^Disconnect / }).first(),
    ],
  },
  {
    id: "consent",
    path: "/consent",
    alt: "The consent page an agent shows before it gets access",
    phone: true,
    ready: (page) => page.getByRole("button", { name: "Allow" }),
    navigate: async (page) => {
      await page.goto("/app/dashboard");
      await agentConsent(page, "Claude", false);
    },
    callouts: (page) => [
      page.getByText("Claude", { exact: true }).first(),
      page.getByRole("button", { name: "Allow" }),
    ],
  },
  {
    id: "sign-in",
    path: "/sign-in",
    alt: "The sign-in page with email, password and a passkey",
    signedOut: true,
    phone: true,
    ready: (page) => page.getByRole("button", { name: "Sign in", exact: true }),
  },
  {
    id: "settings-security",
    path: "/app/settings/security",
    alt: "Settings › Security: two-factor, passkeys and sessions",
    ready: h2(/Security/),
    callouts: (page) => [
      page.getByRole("heading", { name: /Two-factor/ }).first(),
      page.getByRole("heading", { name: /Passkeys/ }).first(),
    ],
  },
  {
    id: "settings-account",
    path: "/app/settings/account",
    alt: "Settings › Account: profile, avatar and email",
    ready: h2(/Account/),
  },
  {
    id: "members",
    path: "/app/members",
    alt: "Members of the sample workspace, with a pending invitation",
    phone: true,
    ready: (page) => page.getByRole("table", { name: "Members" }),
    callouts: (page) => [
      page.getByRole("button", { name: "Invite people" }),
      page.getByRole("cell", { name: "alan@demo.test", exact: true }),
    ],
  },
  {
    id: "invite",
    path: "/app/members",
    alt: "The Invite people dialog",
    ready: (page) => page.getByRole("table", { name: "Members" }),
    prepare: async (page) => {
      await page.getByRole("button", { name: "Invite people" }).click();
      await page.getByRole("dialog", { name: "Invite people" }).waitFor();
    },
  },
  {
    id: "workspace-menu",
    path: "/app/dashboard",
    alt: "The workspace switcher, with Create workspace",
    ready: (page) => page.getByRole("main"),
    prepare: async (page) => {
      await page.getByRole("button", { name: /workspace menu$/ }).click();
      await page.getByRole("menuitem", { name: "Create workspace" }).waitFor();
    },
    callouts: (page) => [
      page.getByRole("menuitem", { name: "Create workspace" }),
    ],
  },
  {
    id: "settings-workspace",
    path: "/app/settings/workspace",
    alt: "Settings › Workspace: name, logo and deletion",
    ready: h2(/Workspace/),
  },
  {
    id: "billing",
    path: "/app/billing",
    alt: "Billing: the plan, trial and usage meters",
    phone: true,
    ready: h2(/Billing/),
  },
  {
    id: "notifications",
    path: "/app/notifications",
    alt: "The notifications inbox",
    ready: h2("Notifications"),
  },
  {
    id: "notification-preferences",
    path: "/app/notifications/preferences",
    alt: "Notification preferences per type and channel",
    ready: h2("Notification settings"),
  },
  {
    id: "settings-privacy",
    path: "/app/settings/privacy",
    alt: "Settings › Privacy: export your data or delete your account",
    ready: h2(/Privacy/),
  },
  {
    id: "trash",
    path: "/app/trash",
    alt: "The Trash, with a deleted note to restore",
    ready: h2("Trash"),
    callouts: (page) => [
      page.getByRole("button", { name: /^Restore/ }).first(),
    ],
  },
  {
    id: "upload-demo",
    path: "/app/upload-demo",
    alt: "The file upload demo: through the app or straight to storage",
    ready: (page) => page.getByRole("heading", { name: "Two ways into R2" }),
  },
  {
    id: "queue-demo",
    path: "/app/queue-demo",
    alt: "The background jobs demo",
    ready: (page) => page.getByRole("main"),
  },
  {
    id: "email-demo",
    path: "/app/email-demo",
    alt: "The email demo",
    ready: (page) => page.getByRole("main"),
  },
  {
    id: "admin-overview",
    path: "/admin/overview",
    alt: "The admin overview: counts, health and the database",
    ready: (page) => page.getByRole("main"),
  },
  {
    id: "admin-users",
    path: "/admin/users",
    alt: "The admin portal's user list",
    ready: (page) => page.getByRole("main"),
  },
  {
    id: "admin-flags",
    path: "/admin/flags",
    alt: "Feature flags in the admin portal",
    ready: (page) => page.getByRole("main"),
  },
  {
    id: "admin-audit",
    path: "/admin/audit",
    alt: "The audit log in the admin portal",
    ready: (page) => page.getByRole("main"),
  },
];
