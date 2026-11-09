import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  appDestinations,
  destinationTitle,
  documentTitle,
  isActiveDestination,
  type NavContext,
  paletteDestinations,
  profileMenuEntries,
  sidebarDestinations,
  workspaceMenuEntries,
} from "./navigation";

/** The container workflow demo's entry; starter-only (container-workflow-demo in starter-only.json). */
const CONTAINER_DEMO = ["container-demo"];

/** Routes that are no destination of their own, with the reason. */
const NOT_DESTINATIONS: Readonly<Record<string, string>> = {
  "/app": "redirects to the dashboard",
  "/app/profile": "redirects to the account settings",
  "/app/notes/$noteId":
    "one note: reached from Notes and the palette's notes search",
  "/app/settings": "the settings layout; its index redirects to Account",
  "/app/settings/": "redirects to the account settings",
};

/** Every `path: "…"` of a routes file; settings children are relative to /app/settings. */
function routePaths(file: string, prefix = ""): string[] {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  return [...source.matchAll(/\bpath:\s*"([^"]+)"/g)].map(([, path]) =>
    path?.startsWith("/app") ? path : `${prefix}${path?.replace(/^\//, "")}`
  );
}

const owner: NavContext = {
  mode: "multi",
  workspace: { kind: "shared", role: "owner" },
  billingMode: "manual",
  admin: false,
};
const member: NavContext = {
  ...owner,
  workspace: { kind: "shared", role: "member" },
};
const ids = (list: readonly { id: string }[]) => list.map((entry) => entry.id);

describe("the app's navigation source", () => {
  it("has a destination for every page route, and every SPA destination is a route", () => {
    const routes = [
      ...routePaths("./routes.tsx"),
      ...routePaths("../settings/routes.tsx", "/app/settings/"),
    ];
    const pages = routes.filter((path) => !(path in NOT_DESTINATIONS));
    const destinations = appDestinations.filter((entry) => !entry.document);
    // The sidebar's Settings entry points at a section's page.
    const targets = new Set(destinations.map((entry) => entry.to));
    expect(pages.filter((path) => !targets.has(path))).toEqual([]);
    expect([...targets].filter((to) => !routes.includes(to))).toEqual([]);
    expect(
      Object.keys(NOT_DESTINATIONS).filter((path) => !routes.includes(path))
    ).toEqual([]);
  });

  it("has unique ids and a title for every page of the SPA", () => {
    expect(new Set(ids(appDestinations)).size).toBe(appDestinations.length);
    for (const entry of appDestinations) {
      if (!entry.document && entry.palette) {
        expect(entry.title, entry.id).toBeTruthy();
      }
    }
  });

  it("gives the top bar a title per page, Note for one note and none for unknown paths", () => {
    expect(destinationTitle("/app/dashboard")).toBe("Dashboard");
    expect(destinationTitle("/app/settings/workspace")).toBe(
      "Workspace settings"
    );
    expect(destinationTitle("/app/notifications/preferences")).toBe(
      "Notification settings"
    );
    expect(destinationTitle("/app/notes/0b6f")).toBe("Note");
    expect(destinationTitle("/app/nope")).toBeNull();
  });

  it("builds the sidebar sections in their order", () => {
    expect(ids(sidebarDestinations(owner, "main"))).toEqual([
      "dashboard",
      "members",
      "billing",
      "trash",
      "settings",
    ]);
    expect(ids(sidebarDestinations(owner, "product"))).toEqual([
      "notes",
      "tasks",
    ]);
    expect(ids(sidebarDestinations(owner, "demos"))).toEqual([
      "upload-demo",
      "queue-demo",
      "email-demo",
      ...CONTAINER_DEMO,
    ]);
    expect(ids(sidebarDestinations(owner, "admin"))).toEqual([]);
  });

  it("lists every page an owner may open in the palette, settings section by section", () => {
    expect(ids(paletteDestinations(owner))).toEqual([
      "dashboard",
      "notes",
      "tasks",
      "notifications",
      "notification-preferences",
      "members",
      "billing",
      "trash",
      "settings-account",
      "settings-appearance",
      "settings-security",
      "settings-connected-agents",
      "settings-privacy",
      "settings-workspace",
      "demos",
      "upload-demo",
      "queue-demo",
      "email-demo",
      ...CONTAINER_DEMO,
    ]);
  });

  it("marks the current page, and every page below a section's prefix", () => {
    const byId = (id: string) =>
      appDestinations.find(
        (entry) => entry.id === id
      ) as (typeof appDestinations)[number];
    expect(isActiveDestination(byId("dashboard"), "/app/dashboard")).toBe(true);
    expect(isActiveDestination(byId("notes"), "/app/notes/0b6f")).toBe(true);
    expect(isActiveDestination(byId("notes"), "/app/notesx")).toBe(false);
    expect(
      isActiveDestination(byId("settings"), "/app/settings/security")
    ).toBe(true);
    expect(isActiveDestination(byId("trash"), "/app/trash/x")).toBe(false);
  });
});

describe("permission filtering", () => {
  it("hides workspace settings from a member, and admin from everyone but admins", () => {
    const seen = ids(paletteDestinations(member));
    expect(seen).not.toContain("settings-workspace");
    expect(seen).not.toContain("admin");
    expect(seen).toContain("settings-account");
    expect(seen).toContain("members");
    expect(ids(paletteDestinations(owner))).not.toContain("admin");
  });

  it("shows the admin portal to an admin (ADMIN_PORTAL on), as a full page load", () => {
    const admin = paletteDestinations({ ...member, admin: true }).find(
      (entry) => entry.id === "admin"
    );
    expect(admin).toMatchObject({ to: "/admin/overview", document: true });
    expect(
      ids(sidebarDestinations({ ...member, admin: true }, "admin"))
    ).toEqual(["admin"]);
  });

  it("follows the workspace mode, the workspace kind and billing", () => {
    const personal = ids(
      paletteDestinations({
        ...owner,
        mode: "personal",
        workspace: { kind: "personal", role: "owner" },
      })
    );
    expect(personal).not.toContain("members");
    expect(personal).toContain("settings-workspace");
    expect(
      ids(
        paletteDestinations({
          ...owner,
          workspace: { kind: "personal", role: "owner" },
        })
      )
    ).not.toContain("members");
    expect(
      ids(paletteDestinations({ ...owner, billingMode: "off" }))
    ).not.toContain("billing");
  });

  it("without a workspace: no workspace pages, but account settings and Notes stay", () => {
    const none = ids(paletteDestinations({ ...owner, workspace: null }));
    expect(none).not.toContain("settings-workspace");
    expect(none).not.toContain("members");
    expect(none).toContain("settings-account");
    expect(none).toContain("notes");
  });
});

describe("the sidebar's menus", () => {
  const PROFILE = [
    "settings-account",
    "settings-security",
    "settings-connected-agents",
    "notification-preferences",
    "settings-appearance",
    "component-library",
    "docs",
  ];

  it("gives the workspace menu the workspace's settings and members, as the role and mode allow", () => {
    expect(ids(workspaceMenuEntries(owner))).toEqual([
      "settings-workspace",
      "members",
    ]);
    expect(ids(workspaceMenuEntries(member))).toEqual(["members"]);
    expect(
      ids(
        workspaceMenuEntries({
          ...owner,
          mode: "personal",
          workspace: { kind: "personal", role: "owner" },
        })
      )
    ).toEqual(["settings-workspace"]);
    expect(ids(workspaceMenuEntries({ ...owner, mode: "single" }))).toEqual([
      "settings-workspace",
      "members",
    ]);
    expect(ids(workspaceMenuEntries({ ...member, mode: "single" }))).toEqual([
      "members",
    ]);
    expect(workspaceMenuEntries({ ...owner, workspace: null })).toEqual([]);
    expect(workspaceMenuEntries(owner)[0]?.label).toBe("Workspace settings");
  });

  it("gives the profile menu the account's pages and help, the admin portal only to admins", () => {
    expect(ids(profileMenuEntries(owner))).toEqual(PROFILE);
    expect(ids(profileMenuEntries({ ...owner, workspace: null }))).toEqual(
      PROFILE
    );
    const admin = profileMenuEntries({ ...member, admin: true });
    expect(ids(admin)).toEqual([...PROFILE, "admin"]);
    expect(admin.at(-1)).toMatchObject({
      label: "Admin portal",
      to: "/admin/overview",
      document: true,
    });
    const byId = Object.fromEntries(admin.map((entry) => [entry.id, entry]));
    expect(byId["component-library"]).toMatchObject({
      to: "/_storybook/",
      document: true,
      newTab: true,
    });
    expect(byId.docs).toMatchObject({ to: "/docs/", document: true });
    expect(byId["settings-account"]).toMatchObject({
      label: "Account settings",
      to: "/app/settings/account",
    });
    expect(byId["settings-account"]?.document).toBeFalsy();
  });

  it("titles the browser tab with the page and the brand", () => {
    const brand = { name: "Starter", titleSeparator: " · " };
    expect(documentTitle("Dashboard", brand)).toBe("Dashboard · Starter");
    expect(
      documentTitle(destinationTitle("/app/settings/security"), brand)
    ).toBe("Security · Starter");
    expect(documentTitle(null, brand)).toBe("Starter");
  });
});
