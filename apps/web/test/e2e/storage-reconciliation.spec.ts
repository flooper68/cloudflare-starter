import { expect, type Route, test } from "@playwright/test";
import { open, readAdminAccounts, signIn } from "./helpers";

/** The real default-off deployment still allows an administrator to request a report. */
test("an admin submits a real storage report and sees the queued run", async ({
  page,
}) => {
  await signIn(page, readAdminAccounts().admin);
  await open(page, "/admin/settings");
  await expect(page.getByText(/Daily maintenance: off/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Delete orphaned objects", exact: true })
  ).toHaveCount(0);
  const response = page.waitForResponse(
    (response) =>
      response.url().includes("admin.storage.reconcile") &&
      response.request().method() === "POST"
  );
  await page
    .getByRole("button", { name: "Run storage report", exact: true })
    .click();
  const reply = (await (await response).json()) as {
    result: { data: { runId: string; jobId: string; mode: string } };
  }[];
  const run = reply[0]?.result.data;
  expect(run?.mode).toBe("report");
  expect(run?.runId).toMatch(/^[0-9a-f-]{36}$/);
  expect(run?.jobId).toMatch(/^[0-9a-f-]{36}$/);
  await expect(
    page.getByText(
      `Queued run ${run?.runId}. Check the audit log for page results.`,
      { exact: true }
    )
  ).toBeVisible();
  await expect(
    page.getByText("Storage report queued", { exact: true })
  ).toBeVisible();
});

/** UI outcome fixtures leave the real environment off; API tests exercise real delete authorization. */
test("delete mode requires confirmation and shows queued or failed outcomes", async ({
  page,
}) => {
  await signIn(page, readAdminAccounts().admin);
  let deletionCalls = 0;
  const runId = "11111111-1111-4111-8111-111111111111";
  async function status(route: Route) {
    const response = await route.fetch();
    const reply = (await response.json()) as { result: { data: unknown } }[];
    const paths =
      decodeURIComponent(new URL(route.request().url()).pathname)
        .split("/api/trpc/")[1]
        ?.split(",") ?? [];
    await route.fulfill({
      response,
      body: JSON.stringify(
        reply.map((item, i) =>
          paths[i] === "admin.storage.status"
            ? { result: { data: { mode: "delete", graceHours: 24 } } }
            : item
        )
      ),
    });
  }
  await page.route(
    (url) => url.pathname.includes("admin.storage.status"),
    status
  );
  await page.route(
    (url) => url.pathname.includes("admin.storage.deleteOrphans"),
    async (route) => {
      deletionCalls++;
      await route.fulfill({
        status: deletionCalls === 1 ? 200 : 500,
        contentType: "application/json",
        body: JSON.stringify([
          deletionCalls === 1
            ? {
                result: {
                  data: {
                    runId,
                    jobId: "22222222-2222-4222-8222-222222222222",
                    mode: "delete",
                  },
                },
              }
            : {
                error: {
                  message: "Storage maintenance unavailable",
                  code: -32603,
                  data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
                },
              },
        ]),
      });
    }
  );
  await open(page, "/admin/settings");
  await expect(page.getByText(/Daily maintenance: delete/)).toBeVisible();
  await page
    .getByRole("button", { name: "Delete orphaned objects", exact: true })
    .click();
  const dialog = page.getByRole("alertdialog", {
    name: "Delete orphaned objects?",
  });
  await expect(dialog).toBeVisible();
  expect(deletionCalls).toBe(0);
  await expect(dialog).toContainText("Active files and trash are preserved");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(deletionCalls).toBe(0);
  await page
    .getByRole("button", { name: "Delete orphaned objects", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Delete orphaned objects", exact: true })
    .click();
  await expect.poll(() => deletionCalls).toBe(1);
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByText(
      `Queued run ${runId}. Check the audit log for page results.`,
      { exact: true }
    )
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete orphaned objects", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Delete orphaned objects", exact: true })
    .click();
  await expect.poll(() => deletionCalls).toBe(2);
  await expect(
    page.getByText("Storage maintenance unavailable", { exact: true })
  ).toBeVisible();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByText(
      `Queued run ${runId}. Check the audit log for page results.`,
      { exact: true }
    )
  ).toBeVisible();
});
