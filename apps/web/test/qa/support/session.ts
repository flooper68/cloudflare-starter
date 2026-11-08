/**
 * The app's navigation as the QA journeys use it, in one place: signing in and out,
 * opening settings, the workspace switcher and the few tRPC calls the UI has no control
 * for. When the shell's menus move, only
 * this file changes.
 */
import type { Page } from "@playwright/test";

import { openProfileMenu } from "../../e2e/helpers";
import { qaEnv } from "./env";
import { expect } from "./fixture";
import { authPolicies, takeSlots } from "./limits";

/**
 * How long a step that calls /api/auth may take: its request can wait for a rate-limit
 * slot (limits.ts: a full window of quiet after a burst) before the server even sees it.
 */
export const AUTH_WAIT = 150_000;

/** A QA account as a journey holds it: the password changes when the journey changes it. */
export interface Account {
  email: string;
  password: string;
}

/** Opens a page and waits until its React islands have hydrated. */
export async function open(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.locator("astro-island[ssr]")).toHaveCount(0);
}

/** Fills and submits the sign-in form; the caller checks the outcome. */
export async function submitSignIn(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await open(page, "/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

/** Signs in with the password and lands on `landing` (the dashboard by default). */
export async function signIn(
  page: Page,
  account: Account,
  landing: RegExp = /\/app\/dashboard$/
): Promise<void> {
  await submitSignIn(page, account.email, account.password);
  await expect(page).toHaveURL(landing, { timeout: AUTH_WAIT });
}

/** Signs out from the app shell's profile menu (the E2E suite's helper); lands on `/`. */
export async function signOut(page: Page): Promise<void> {
  if (!new URL(page.url()).pathname.startsWith("/app")) {
    await open(page, "/app/dashboard");
  }
  await openProfileMenu(page);
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: AUTH_WAIT });
}

export type SettingsSection =
  | "account"
  | "appearance"
  | "security"
  | "privacy"
  | "connected-agents"
  | "workspace";

/** Opens one settings section (by URL: stable whichever menu links to it). */
export async function openSettings(
  page: Page,
  section: SettingsSection
): Promise<void> {
  await open(page, `/app/settings/${section}`);
}

/** The signed-in person's name, as Settings › Account shows it. */
export async function displayName(page: Page): Promise<string> {
  await openSettings(page, "account");
  const name = page.getByLabel("Name", { exact: true });
  await expect(name).not.toHaveValue("");
  return name.inputValue();
}

/** The workspace switcher's trigger, named after the active workspace. */
export function workspaceMenu(page: Page, workspace?: string) {
  return workspace
    ? page.getByRole("button", { name: `${workspace} workspace menu` })
    : page.getByRole("button", { name: /workspace menu$/ });
}

/** Creates a workspace from the switcher; it becomes the active one. */
export async function createWorkspace(page: Page, name: string): Promise<void> {
  await open(page, "/app/dashboard");
  await workspaceMenu(page).click();
  await page.getByRole("menuitem", { name: "Create workspace" }).click();
  const dialog = page.getByRole("dialog", { name: "Create workspace" });
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByRole("button", { name: "Create" }).click();
  await expect(workspaceMenu(page, name)).toBeVisible();
}

/** Switches the active workspace with the switcher. */
export async function switchWorkspace(page: Page, name: string): Promise<void> {
  await workspaceMenu(page).click();
  await page
    .getByRole("menuitem", { name: new RegExp(`^${escapeRegExp(name)}`) })
    .click();
  await expect(workspaceMenu(page, name)).toBeVisible();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Headers of an API call made outside the page (page.request): origin and QA token. */
export function apiHeaders(): Record<string, string> {
  const { baseUrl, qaToken } = qaEnv();
  return { origin: baseUrl, "x-qa-token": qaToken };
}

/**
 * Calls a tRPC procedure as the page's signed-in person, the way the app's client does
 * (`x-trpc-source: app`). Only for actions the UI has no control for.
 */
export async function trpc<T>(
  page: Page,
  path: string,
  input: unknown,
  kind: "query" | "mutation" = "mutation"
): Promise<T> {
  const headers = { ...apiHeaders(), "x-trpc-source": "app" };
  const response =
    kind === "query"
      ? await page.request.get(
          `/api/trpc/${path}?input=${encodeURIComponent(JSON.stringify(input))}`,
          { headers }
        )
      : await page.request.post(`/api/trpc/${path}`, { headers, data: input });
  const body = (await response.json()) as {
    result?: { data: T };
    error?: { message?: string };
  };
  if (!response.ok() || !body.result) {
    throw new Error(
      `tRPC ${path} answered ${response.status()}: ${body.error?.message ?? ""}`
    );
  }
  return body.result.data;
}

/** An /api/auth call outside the page, through the run's rate-limit slots. */
export async function authSlot(path: string): Promise<void> {
  await takeSlots(authPolicies(path));
}
