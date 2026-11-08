import { expect, test } from "./fixtures";

import { open, sharedSession } from "./helpers";

// The container workflow demo as the shared user, against `astro dev`: the real Workflow
// runs in Miniflare with the fake pi computer (CONTAINER_DEMO_RUNNER=fake in the develop
// vars), so no Docker and no Cloudflare account. One run per test: a user may start
// five an hour.
test.use({ storageState: sharedSession });

test("containers: start a run, watch every step, see the result and the past run", async ({
  page,
}) => {
  await open(page, "/app/demos");
  await page.getByRole("link", { name: "Run a workflow" }).click();
  await expect(page).toHaveURL(/\/app\/container-demo$/);
  await expect(
    page.getByRole("heading", { name: "Containers: run a workflow" })
  ).toBeVisible();

  await page.getByRole("radio", { name: "1,000" }).click();
  await page.getByRole("button", { name: "Start run" }).click();
  await expect(page).toHaveURL(/\/app\/container-demo\?run=[0-9a-f-]{36}$/);

  const run = page.getByTestId("container-run");
  const steps = run.getByRole("list", { name: "Run steps" });
  await expect(steps.getByRole("listitem")).toHaveText([
    /Queued/,
    /Starting container/,
    /Computing/,
    /Storing in R2/,
    /Notifying/,
    /Done/,
  ]);
  // The page polls while the workflow runs; the fake container takes about a second.
  await expect(run).toHaveAttribute("data-status", "succeeded", {
    timeout: 45_000,
  });
  for (const item of await steps.getByRole("listitem").all()) {
    await expect(item).toHaveAttribute("data-status", "done");
  }

  await expect(page.getByTestId("run-preview")).toContainText(
    "3.14159265358979323846"
  );
  await expect(page.getByTestId("run-duration")).toHaveText(/\d/);
  const download = page.getByRole("link", {
    name: "Download all 1,000 digits",
  });
  await expect(download).toHaveAttribute(
    "href",
    /^\/api\/container-runs\/[0-9a-f-]{36}\/result\?workspaceId=/
  );
  const href = await download.getAttribute("href");
  expect(href).not.toBeNull();
  const file = await page.request.get(href ?? "");
  expect(file.status()).toBe(200);
  expect((await file.text()).trim()).toMatch(/^3\.14159\d{994}$/);

  // The run is listed under past runs.
  const past = page.getByRole("list", { name: "Past runs" });
  await expect(past.getByRole("listitem").first()).toContainText(
    "1,000 digits"
  );
  await expect(past.getByRole("listitem").first()).toContainText("Succeeded");
});
