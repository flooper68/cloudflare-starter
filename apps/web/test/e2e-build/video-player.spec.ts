/**
 * The walkthrough player and the loops on the home page and in a doc, as built: nothing
 * plays with sound or on its own, the walkthrough loads nothing before Play, chapters and
 * the transcript work by keyboard, loops stay still under reduced motion, and missing
 * media (CI's R2 is empty) falls back to the poster's stand-in. Every test fails on a CSP
 * violation (fixtures.ts); axe runs on these pages in a11y.spec.ts.
 */
import { MEDIA_MANIFEST } from "../../src/content/media";
import { HOME_CLIPS, HOME_WALKTHROUGH } from "../../src/content/videos";
import { expect, type Page, test } from "../e2e/fixtures";

const tour = MEDIA_MANIFEST.videos[HOME_WALKTHROUGH];

/** The media as it is before an upload: every /media/ request is a 404. */
async function withoutMedia(page: Page): Promise<string[]> {
  const requested: string[] = [];
  await page.route("**/media/**", (route) => {
    requested.push(new URL(route.request().url()).pathname);
    return route.fulfill({ status: 404, body: "Not found" });
  });
  return requested;
}

test.describe("video player", () => {
  test.skip(!tour, "the tour is not recorded yet");

  test("the walkthrough waits for Play, then says when its media is missing", async ({
    page,
  }) => {
    const requested = await withoutMedia(page);
    await page.goto("/");
    const player = page.getByRole("group", { name: `Video: ${tour?.title}` });
    await player.scrollIntoViewIfNeeded();
    const play = player.getByRole("button", { name: /^Play The starter/ });
    await expect(play).toBeVisible();
    await expect(player.locator("video")).toBeHidden();
    await expect(player.locator("video")).not.toHaveAttribute("autoplay");
    await expect(player).toContainText("Captions on");
    await expect(player).toContainText("No sound");
    const tourMedia = (paths: string[]) =>
      paths.filter((path) =>
        new RegExp(`/${HOME_WALKTHROUGH}\\.(mp4|webm|vtt)$`).test(path)
      );
    expect(tourMedia(requested)).toEqual([]);

    await play.click();
    await expect(player.getByRole("status")).toHaveText(
      "This video is not available yet."
    );
    await expect(player.locator("video")).not.toHaveAttribute("controls");
  });

  test("chapters and the transcript work by keyboard", async ({ page }) => {
    await withoutMedia(page);
    await page.goto("/");
    const player = page.getByRole("group", { name: `Video: ${tour?.title}` });
    const chapters = player.getByRole("list", { name: "Chapters" });
    await expect(chapters.getByRole("button")).toHaveCount(
      tour?.chapters.length ?? 0
    );
    const second = chapters.getByRole("button").nth(1);
    await second.focus();
    await expect(second).toBeFocused();

    const transcript = player.getByText("Read the transcript");
    await transcript.focus();
    await page.keyboard.press("Enter");
    await expect(
      player.getByText(tour?.chapters[0]?.caption ?? "")
    ).toBeVisible();
  });

  test("loops are muted, never autoplay with sound, and have a pause button", async ({
    page,
  }) => {
    await withoutMedia(page);
    await page.goto("/");
    for (const id of Object.values(HOME_CLIPS)) {
      const entry = MEDIA_MANIFEST.videos[id];
      if (!entry) continue;
      const video = page.locator(
        `video[aria-label="${entry.title}, a muted clip"]`
      );
      await expect(video).toHaveJSProperty("muted", true);
      await expect(video).toHaveAttribute("loop", "");
      await expect(video).not.toHaveAttribute("autoplay");
      await expect(
        page.getByRole("button", { name: new RegExp(`clip: ${entry.title}$`) })
      ).toBeAttached();
    }
  });

  test("the MCP guide opens with its walkthrough", async ({ page }) => {
    await withoutMedia(page);
    await page.goto("/docs/guides/how-to-setup-mcp/");
    const agents = MEDIA_MANIFEST.videos.agents;
    test.skip(!agents, "agents is not recorded yet");
    await expect(
      page.getByRole("group", { name: `Video: ${agents?.title}` })
    ).toBeVisible();
  });
});

test.describe("video player under reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("loops wait on their poster with a Play button", async ({ page }) => {
    const requested = await withoutMedia(page);
    await page.goto("/");
    const first = MEDIA_MANIFEST.videos[HOME_CLIPS.agents];
    test.skip(!first, "the agents clip is not recorded yet");
    const card = page.getByRole("button", {
      name: `Play clip: ${first?.title}`,
    });
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    expect(requested.filter((path) => /\.(mp4|webm)$/.test(path))).toEqual([]);
    const paused = await page
      .locator("walkthrough-video[data-loop] video")
      .evaluateAll((videos) =>
        videos.every((video) => (video as HTMLVideoElement).paused)
      );
    expect(paused).toBe(true);
  });
});
