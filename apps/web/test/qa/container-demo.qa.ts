import { readFile } from "node:fs/promises";

import {
  expect,
  newQaAccount,
  newUserPage,
  type Page,
  skipWithoutQaEnv,
  test,
} from "./support/journey";
import { open } from "./support/session";

// Checklist: Demos: containers (a workflow). One account starts one run of the smallest
// preset (1,000 digits) and follows it through its Workflow to the result, the download,
// the past runs and the bell. Each run starts a billed container and counts against the
// deployment's daily cap (CONTAINER_DEMO_DAILY_CAP, 100 on production): a run starts at
// most two, the second only as the Retry of a first run that failed (the first minutes
// after a container deploy). The account's erasure in the cleanup deletes its workspace,
// and with it the runs and their R2 results (deleteWorkspaceContainerRuns, erasure-catalog.ts).
skipWithoutQaEnv();
test.describe.configure({ mode: "serial" });

let page: Page;
/** Runs this account started: the hourly allowance the card shows counts them. */
let started = 0;
let runId: string;

/** The smallest preset, so the container's compute stays short. */
const DIGITS = "1,000";
/** A container cold start takes tens of seconds; the workflow retries a failed step. */
const RUN_TIMEOUT = 3 * 60_000;
const STEP_LABELS = [
  /Queued/,
  /Starting container/,
  /Computing/,
  /Storing in R2/,
  /Notifying/,
  /Done/,
];
/** One look after a reload: longer than the page takes to show its data (notifications.qa.ts). */
const PAGE_LOAD = 10_000;

test.beforeAll(async ({ browser }) => {
  page = await newUserPage(browser);
  await newQaAccount(page, { role: "containers" });
});

test.afterAll(async () => {
  await page?.context().close();
});

/** The id in `/app/container-demo?run=<id>`. */
function runIdOf(url: string): string {
  return new URL(url).searchParams.get("run") ?? "";
}

/**
 * Follows the run on show until it succeeds or fails, polling the page it polls itself.
 * On every look the steps are in order: nothing is done after a step still pending or
 * running. Returns the final status.
 */
async function followRun(): Promise<string> {
  const run = page.getByTestId("container-run");
  const items = run
    .getByRole("list", { name: "Run steps" })
    .getByRole("listitem");
  await expect(items).toHaveText(STEP_LABELS);
  let status = "";
  let outOfOrder: string | null = null;
  await expect
    .poll(
      async () => {
        const steps = await items.evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute("data-status") ?? "")
        );
        const firstOpen = steps.findIndex(
          (step) => step === "pending" || step === "running"
        );
        const lastDone = steps.lastIndexOf("done");
        if (firstOpen !== -1 && lastDone > firstOpen) {
          outOfOrder ??= steps.join(", ");
        }
        status = (await run.getAttribute("data-status")) ?? "";
        return status;
      },
      { timeout: RUN_TIMEOUT, intervals: [1000] }
    )
    .toMatch(/^(succeeded|failed)$/);
  expect(
    outOfOrder,
    "a step done after one still pending or running"
  ).toBeNull();
  return status;
}

test("Developer demos opens the container demo, which says what is left", async () => {
  await open(page, "/app/demos");
  await page.getByRole("link", { name: "Open containers demo" }).click();
  await expect(page).toHaveURL(/\/app\/container-demo$/);
  await expect(
    page.getByRole("heading", { name: "Containers: run a workflow" })
  ).toBeVisible();
  await expect(page.getByText("No runs yet")).toBeVisible();
  const allowance = page.getByText(/runs left today for everyone/);
  await expect(allowance).toBeVisible();
  const unavailable = page.getByTestId("container-demo-unavailable");
  if (await unavailable.isVisible()) {
    // Off here (CONTAINER_DEMO=off) or today's cap is used up: nothing to run.
    const reason = (await unavailable.textContent()) ?? "unavailable";
    await expect(
      page.getByRole("button", { name: "Start run" })
    ).toBeDisabled();
    test.skip(true, `the container demo cannot start a run: ${reason}`);
  }
  await expect(allowance).toContainText("5 of 5 left for you this hour");
});

test("a 1,000-digit run goes through every step to the digits of pi", async () => {
  test.skip(
    (await page.getByTestId("container-demo-unavailable").count()) > 0,
    "the container demo cannot start a run here"
  );
  // Up to two cold starts and their step retries.
  test.setTimeout(2 * RUN_TIMEOUT + 60_000);
  await page.getByRole("radio", { name: DIGITS }).click();
  await page.getByRole("button", { name: "Start run" }).click();
  started += 1;
  await expect(page).toHaveURL(/\/app\/container-demo\?run=[0-9a-f-]{36}$/);
  const run = page.getByTestId("container-run");
  await expect(run).toContainText(`${DIGITS} digits of pi`);

  if ((await followRun()) === "failed") {
    // The first minutes after a container deploy: the reason, then one Retry (a new run
    // with the same digits); a second failure fails the journey.
    await expect(run.getByRole("button", { name: "Retry" })).toBeVisible();
    const failedId = runIdOf(page.url());
    await run.getByRole("button", { name: "Retry" }).click();
    started += 1;
    await expect
      .poll(() => runIdOf(page.url()), { timeout: 30_000 })
      .not.toBe(failedId);
    expect(await followRun()).toBe("succeeded");
  }
  runId = runIdOf(page.url());

  // Every step done, each but the last with its time.
  const items = run
    .getByRole("list", { name: "Run steps" })
    .getByRole("listitem");
  for (const item of await items.all()) {
    await expect(item).toHaveAttribute("data-status", "done");
  }
  for (const item of (await items.all()).slice(0, -1)) {
    await expect(item).toHaveText(/\d/);
  }
  await expect(run.getByText("Succeeded", { exact: true })).toBeVisible();
  await expect(page.getByTestId("run-preview")).toContainText(
    "3.14159265358979323846"
  );
  await expect(page.getByTestId("run-duration")).toHaveText(/\d/);
  await expect(run).not.toContainText("[object Object]");
});

test("the result downloads as a text file of all the digits", async () => {
  test.skip(!runId, "no run succeeded");
  const link = page.getByRole("link", {
    name: `Download all ${DIGITS} digits`,
  });
  await expect(link).toHaveAttribute(
    "href",
    /^\/api\/container-runs\/[0-9a-f-]{36}\/result\?workspaceId=/
  );
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    link.click(),
  ]);
  const path = await download.path();
  const text = (await readFile(path, "utf8")).trim();
  expect(text).toMatch(/^3\.14159\d{995}$/);
});

test("the run is listed under past runs, and the hourly allowance counts it", async () => {
  test.skip(!runId, "no run succeeded");
  // A fresh load: the list and the allowance as the server has them now.
  await open(page, `/app/container-demo?run=${runId}`);
  const latest = page
    .getByRole("list", { name: "Past runs" })
    .getByRole("listitem")
    .first();
  await expect(latest).toContainText(`${DIGITS} digits`);
  await expect(latest).toContainText("Succeeded");
  await expect(page.getByText(/runs left today for everyone/)).toContainText(
    `${5 - started} of 5 left for you this hour`
  );
});

test("the bell has the finished run, linking back to it", async () => {
  test.skip(!runId, "no run succeeded");
  const title = `Container run finished: ${DIGITS} digits of pi`;
  const list = page.getByRole("list", { name: "Notifications" });
  await expect(async () => {
    await open(page, "/app/notifications");
    await expect(list.getByRole("link", { name: title }).first()).toBeVisible({
      timeout: PAGE_LOAD,
    });
  }).toPass({ timeout: 60_000 });
  await list.getByRole("link", { name: title }).first().click();
  await expect(page).toHaveURL(
    new RegExp(`/app/container-demo\\?run=${runId}$`)
  );
  await expect(page.getByTestId("container-run")).toHaveAttribute(
    "data-status",
    "succeeded"
  );
});

test("the hourly limit message", async () => {
  test.skip(
    true,
    "reaching it takes five container runs (CONTAINER_RUN_USER_HOURLY_LIMIT), each a billed container and 5% of production's daily cap per QA run; the API tests cover the limit (test/api/container-runs.test.ts)"
  );
});
