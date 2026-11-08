/**
 * The screenshot pass for the design-match review: each capture is attached to the HTML
 * report as `<section>-<screen>-<viewport>-<theme>.png` (and saved under the test's output
 * folder). The theme is the OS preference (`prefers-color-scheme`), which the app follows
 * while the person's theme setting is System, its default.
 */
import type { Page, TestInfo } from "@playwright/test";

import { expect } from "./index";

export const VIEWPORTS = {
  "1440": { width: 1440, height: 900 },
  "390": { width: 390, height: 844 },
} as const;

export type Viewport = keyof typeof VIEWPORTS;
export type Theme = "dark" | "light";

export async function setLook(
  page: Page,
  viewport: Viewport,
  theme: Theme
): Promise<void> {
  await page.setViewportSize(VIEWPORTS[viewport]);
  await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
}

/** Captures the full page, checks nothing scrolls sideways, and attaches it. */
export async function capture(
  page: Page,
  testInfo: TestInfo,
  name: { section: string; screen: string; viewport: Viewport; theme: Theme }
): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  const file = `${name.section}-${name.screen}-${name.viewport}-${name.theme}.png`;
  expect(overflow, `${file}: the page scrolls sideways`).toBeLessThanOrEqual(0);
  const path = testInfo.outputPath(file);
  await page.screenshot({ path, fullPage: true, animations: "disabled" });
  await testInfo.attach(file, { path, contentType: "image/png" });
}
