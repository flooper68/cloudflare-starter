/**
 * `bun run docs:screenshots`: seeds the demo world (test/seed/demo.ts) on the local dev
 * server, then captures every shot in shots.ts in the dark and the light theme at
 * 1440 × 900 (and at phone size where asked), encodes each as WebP under 150 KB with
 * Chromium's own encoder (no image tool to install), measures the callout elements and
 * writes docs/images/screens/<id>.<variant>.webp plus manifest.json. `--grep <id>` takes
 * a subset; the manifest keeps the other shots.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Browser, BrowserContext, Page } from "@playwright/test";
import type { Callout, ShotVariant } from "../../src/docs/kit/render";
import {
  SCREENS_DIR,
  SCREENS_MANIFEST,
  type ScreensManifest,
  shotFile,
} from "../../src/docs/kit/shots";
import { expect, test } from "../e2e/fixtures";
import { open } from "../e2e/helpers";
import { seedDemo } from "../seed/demo";
import { SHOTS, type Shot } from "./shots";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const OUT = join(ROOT, SCREENS_DIR);
const MANIFEST = join(ROOT, SCREENS_MANIFEST);
const SESSION = "test-results/screens/ada.json";
/** The budget per image; the encoder lowers its quality until it fits. */
const MAX_BYTES = 150 * 1024;

const VARIANTS: Record<
  ShotVariant,
  {
    colorScheme: "dark" | "light";
    viewport: { width: number; height: number };
    scale: number;
  }
> = {
  dark: {
    colorScheme: "dark",
    viewport: { width: 1440, height: 900 },
    scale: 1,
  },
  light: {
    colorScheme: "light",
    viewport: { width: 1440, height: 900 },
    scale: 1,
  },
  "phone-dark": {
    colorScheme: "dark",
    viewport: { width: 390, height: 844 },
    scale: 2,
  },
  "phone-light": {
    colorScheme: "light",
    viewport: { width: 390, height: 844 },
    scale: 2,
  },
};

function readManifest(): ScreensManifest {
  if (!existsSync(MANIFEST)) return { version: 1, shots: {} };
  return JSON.parse(readFileSync(MANIFEST, "utf8")) as ScreensManifest;
}

/** PNG → WebP in a blank page, as small as it takes to fit MAX_BYTES. */
async function toWebp(encoder: Page, png: Buffer): Promise<Buffer> {
  for (const quality of [0.8, 0.72, 0.64, 0.56, 0.48]) {
    const base64 = await encoder.evaluate(
      async ({ data, q }) => {
        const image = new Image();
        image.src = `data:image/png;base64,${data}`;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        canvas.getContext("2d")?.drawImage(image, 0, 0);
        return canvas.toDataURL("image/webp", q).split(",")[1] ?? "";
      },
      { data: png.toString("base64"), q: quality }
    );
    const webp = Buffer.from(base64, "base64");
    if (webp.length <= MAX_BYTES || quality === 0.48) return webp;
  }
  throw new Error("unreachable");
}

/**
 * Each callout at its element's top-right corner, as percent of the viewport; null when
 * the element is not on this variant's screen (a phone hides the sidebar), and the doc
 * then shows no marker for it there.
 */
async function measure(
  page: Page,
  shot: Shot,
  variant: ShotVariant
): Promise<(Callout | null)[]> {
  const viewport = page.viewportSize();
  if (!viewport || !shot.callouts) return [];
  const callouts: (Callout | null)[] = [];
  for (const locator of shot.callouts(page)) {
    // Data loads after the page is ready: give each element a moment to appear.
    await locator
      .waitFor({ state: "visible", timeout: 8000 })
      .catch(() => undefined);
    const box = (await locator.isVisible())
      ? await locator.boundingBox()
      : null;
    const inView =
      box &&
      box.y >= 0 &&
      box.y < viewport.height &&
      box.x >= 0 &&
      box.x < viewport.width;
    if (!box || !inView) {
      if (!variant.startsWith("phone"))
        throw new Error(
          `${shot.id} (${variant}): a callout element is not on screen`
        );
      callouts.push(null);
      continue;
    }
    const clamp = (value: number) =>
      Math.min(97, Math.max(3, Math.round(value * 10) / 10));
    callouts.push({
      x: clamp(((box.x + box.width) / viewport.width) * 100),
      y: clamp((box.y / viewport.height) * 100),
    });
  }
  return callouts;
}

test.describe.configure({ mode: "default" });

test("seed the demo world", async ({ page }) => {
  test.setTimeout(240_000);
  // SKIP_SEED=1 reuses the last run's session (iterating on one shot).
  if (process.env.SKIP_SEED === "1" && existsSync(SESSION)) return;
  await seedDemo(page);
  mkdirSync(dirname(SESSION), { recursive: true });
  await page.context().storageState({ path: SESSION });
});

const only = process.env.SHOTS?.split(",").filter(Boolean);

for (const shot of SHOTS.filter((entry) => !only || only.includes(entry.id))) {
  test(`capture ${shot.id}`, async ({ browser }) => {
    test.setTimeout(120_000);
    const variants: ShotVariant[] = shot.phone
      ? ["dark", "light", "phone-dark", "phone-light"]
      : ["dark", "light"];
    const encoderContext = await browser.newContext();
    const encoder = await encoderContext.newPage();
    const images: ScreensManifest["shots"][string]["variants"] = {};
    mkdirSync(OUT, { recursive: true });
    for (const variant of variants) {
      const context = await newContext(browser, shot, variant);
      const page = await context.newPage();
      await show(page, shot);
      const png = await page.screenshot({
        animations: "disabled",
        caret: "hide",
      });
      const callouts = await measure(page, shot, variant);
      const webp = await toWebp(encoder, png);
      const file = shotFile(shot.id, variant);
      writeFileSync(join(OUT, file), webp);
      const { viewport, scale } = VARIANTS[variant];
      images[variant] = {
        file,
        width: viewport.width * scale,
        height: viewport.height * scale,
        bytes: webp.length,
        callouts,
      };
      await context.close();
    }
    // Drop the files of variants this shot no longer has.
    for (const variant of Object.keys(VARIANTS) as ShotVariant[])
      if (!images[variant])
        rmSync(join(OUT, shotFile(shot.id, variant)), { force: true });
    await encoderContext.close();
    const next: ScreensManifest = {
      version: 1,
      shots: {
        ...readManifest().shots,
        [shot.id]: { path: shot.path, alt: shot.alt, variants: images },
      },
    };
    const sorted = Object.fromEntries(
      Object.entries(next.shots).sort(([a], [b]) => a.localeCompare(b))
    );
    writeFileSync(
      MANIFEST,
      `${JSON.stringify({ version: 1, shots: sorted }, null, 2)}\n`
    );
    expect(Object.keys(images)).toHaveLength(variants.length);
  });
}

async function newContext(
  browser: Browser,
  shot: Shot,
  variant: ShotVariant
): Promise<BrowserContext> {
  const { colorScheme, viewport, scale } = VARIANTS[variant];
  return browser.newContext({
    colorScheme,
    viewport,
    deviceScaleFactor: scale,
    reducedMotion: "reduce",
    isMobile: variant.startsWith("phone"),
    hasTouch: variant.startsWith("phone"),
    storageState: shot.signedOut ? { cookies: [], origins: [] } : SESSION,
  });
}

async function show(page: Page, shot: Shot) {
  if (shot.navigate) await shot.navigate(page);
  else await open(page, shot.path);
  await expect(shot.ready(page)).toBeVisible();
  await page.waitForLoadState("networkidle");
  if (shot.prepare) await shot.prepare(page);
  // Fonts and images settled, the pointer out of the way.
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
  // Never commit the dev server's error overlay (a reload mid-capture shows it).
  await expect(page.getByText("An error occurred.")).toHaveCount(0);
  if (!shot.prepare) await expect(shot.ready(page)).toBeVisible();
}
