/**
 * The walkthrough player and the loops on the home page and in a doc, as built: nothing
 * plays with sound or on its own, the walkthrough loads nothing before Play, chapters and
 * the transcript work by keyboard, loops stay still under reduced motion, and missing
 * media (CI's R2 is empty) falls back to the poster's stand-in. A card clip opens large:
 * the lightbox by click or keyboard, closed by Escape, Close or the backdrop with focus
 * back on the card, native full screen on a touch screen, a Play button under reduced
 * motion. Every test fails on a CSP violation (fixtures.ts); axe runs on these pages,
 * and on the open lightbox, in a11y.spec.ts.
 */
import { MEDIA_MANIFEST } from "../../src/content/media";
import { HOME_CLIPS, HOME_WALKTHROUGH } from "../../src/content/videos";
import { expect, type Page, test } from "../e2e/fixtures";

const tour = HOME_WALKTHROUGH
  ? MEDIA_MANIFEST.videos[HOME_WALKTHROUGH]
  : undefined;

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

  test("the agents feature page plays its walkthrough", async ({ page }) => {
    await withoutMedia(page);
    await page.goto("/docs/features/agents/");
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
    const first = HOME_CLIPS.agents
      ? MEDIA_MANIFEST.videos[HOME_CLIPS.agents]
      : undefined;
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

const firstClip = HOME_CLIPS.agents
  ? MEDIA_MANIFEST.videos[HOME_CLIPS.agents]
  : undefined;

test.describe("a clip opened large", () => {
  test.skip(!firstClip, "the agents clip is not recorded yet");
  const title = firstClip?.title ?? "";

  test("a click on the clip opens the lightbox; Escape closes it and focus returns", async ({
    page,
  }) => {
    await withoutMedia(page);
    await page.goto("/");
    const expand = page.getByRole("button", {
      name: `Play full screen: ${title}`,
    });
    await expand.scrollIntoViewIfNeeded();
    const stage = page
      .locator("walkthrough-video[data-loop] .wv-stage")
      .first();
    await expect(stage).toHaveCSS("cursor", "zoom-in");
    await stage.click();

    const dialog = page.getByRole("dialog", { name: title });
    await expect(dialog).toBeVisible();
    const video = dialog.locator("video");
    await expect(video).toHaveAttribute("controls", "");
    await expect(video).toHaveJSProperty("muted", true);
    await expect(
      dialog.getByRole("button", { name: "Full screen" })
    ).toBeVisible();
    // About 90% of the viewport wide (or as tall as fits), in the clip's aspect ratio.
    const box = await dialog.boundingBox();
    const viewport = page.viewportSize();
    expect(box?.width ?? 0).toBeGreaterThan((viewport?.width ?? 0) * 0.6);
    // CI's R2 is empty: the lightbox says so instead of a black box.
    await expect(dialog.getByRole("status")).toHaveText(
      "This video is not available yet."
    );

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.locator(".wv-lightbox video")).toHaveCount(0);
    await expect(expand).toBeFocused();
  });

  test("Enter and Space on the expand button open it; Close and the backdrop close it", async ({
    page,
  }) => {
    await withoutMedia(page);
    await page.goto("/");
    const expand = page.getByRole("button", {
      name: `Play full screen: ${title}`,
    });
    const dialog = page.getByRole("dialog", { name: title });

    await expand.focus();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toBeHidden();
    await expect(expand).toBeFocused();

    await page.keyboard.press("Space");
    await expect(dialog).toBeVisible();
    await page.mouse.click(4, 4);
    await expect(dialog).toBeHidden();
    await expect(expand).toBeFocused();
  });

  test("on a touch screen the clip goes straight to native full screen", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    await withoutMedia(page);
    await page.goto("/");
    const expand = page.getByRole("button", {
      name: `Play full screen: ${title}`,
    });
    await expand.scrollIntoViewIfNeeded();
    await expand.tap();
    await expect
      .poll(() =>
        page.evaluate(() => document.fullscreenElement?.tagName ?? null)
      )
      .toBe("VIDEO");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.evaluate(() => document.exitFullscreen());
    await expect
      .poll(() =>
        page
          .locator("walkthrough-video[data-loop] video")
          .first()
          .evaluate((video) => (video as HTMLVideoElement).controls)
      )
      .toBe(false);
    await context.close();
  });
});

test.describe("a clip opened large under reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("waits on the poster with a Play button", async ({ page }) => {
    test.skip(!firstClip, "the agents clip is not recorded yet");
    await withoutMedia(page);
    // The posters exist (a 1×1 image), the videos do not.
    await page.route("**/media/**/*.jpg", (route) =>
      route.fulfill({
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
          "base64"
        ),
      })
    );
    await page.goto("/");
    await page
      .getByRole("button", { name: `Play full screen: ${firstClip?.title}` })
      .click();
    const dialog = page.getByRole("dialog", { name: firstClip?.title });
    const play = dialog.getByRole("button", {
      name: `Play ${firstClip?.title}`,
    });
    await expect(play).toBeVisible();
    await expect(play).toBeFocused();
    await expect(dialog.locator("video")).toHaveJSProperty("paused", true);
    await expect(dialog.locator("video")).toHaveAttribute(
      "poster",
      new RegExp(`${firstClip?.poster.src}$`)
    );
  });
});
