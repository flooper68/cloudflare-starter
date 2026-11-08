import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Opens a path of the app and waits until its React islands have hydrated (Astro drops
 * the `ssr` attribute then); a form submitted earlier would post natively.
 */
export async function open(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.locator("astro-island[ssr]")).toHaveCount(0, {
    timeout: 20_000,
  });
}

/**
 * Waits until an auth form can be sent: its button is enabled only once React has
 * hydrated the form and the human check has passed. Astro drops `ssr` from the island
 * as hydration starts, before React commits, so text typed earlier can be reset by the
 * hydrating form (it then reports "Email is required").
 */
export async function waitForForm(submit: Locator): Promise<void> {
  await expect(submit).toBeEnabled({ timeout: 30_000 });
}

/** Signs in through the real form; ends on the dashboard. */
export async function signIn(
  page: Page,
  account: { readonly email: string; readonly password: string }
): Promise<void> {
  await open(page, "/sign-in");
  const submit = page.getByRole("button", { name: "Sign in", exact: true });
  await waitForForm(submit);
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await submit.click();
  await expect(page).toHaveURL(/\/app\/dashboard$/, { timeout: 30_000 });
}

/**
 * Calls a tRPC procedure of the app as the signed-in page does (same origin, its
 * cookies, `x-trpc-source: app`): the real API the UI uses, never the database.
 */
export async function callApp<T>(
  page: Page,
  kind: "query" | "mutation",
  path: string,
  input?: unknown
): Promise<T> {
  const answer = await page.evaluate(
    async ({ kind, path, input }) => {
      const url =
        kind === "query"
          ? `/api/trpc/${path}${input === undefined ? "" : `?input=${encodeURIComponent(JSON.stringify(input))}`}`
          : `/api/trpc/${path}`;
      const response = await fetch(url, {
        method: kind === "query" ? "GET" : "POST",
        headers: { "content-type": "application/json", "x-trpc-source": "app" },
        body: kind === "mutation" ? JSON.stringify(input ?? {}) : undefined,
      });
      return { status: response.status, body: await response.text() };
    },
    { kind, path, input }
  );
  const parsed = JSON.parse(answer.body) as {
    result?: { data?: unknown };
    error?: { message?: string; data?: { code?: string; appCode?: string } };
  };
  if (parsed.error || answer.status >= 400) {
    const code = parsed.error?.data?.appCode ?? parsed.error?.data?.code;
    throw new Error(
      `${path} answered ${answer.status}${code ? ` ${code}` : ""}: ${parsed.error?.message ?? answer.body.slice(0, 200)}`
    );
  }
  return parsed.result?.data as T;
}
