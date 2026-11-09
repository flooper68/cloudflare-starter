/**
 * Drives one recording at a human pace and keeps its timeline: eased cursor moves, a
 * pause before each click, typing with a steady rhythm, and the storyboard's steps as
 * timestamps (chapters and captions). `step({ at })` waits until the planned second of
 * the storyboard, so a video keeps its length when the app gets faster; a step that
 * starts late is reported, not hidden.
 */
import type { Locator, Page } from "@playwright/test";

import type { ConsoleLine } from "./overlay";

export interface StepMark {
  /** Seconds from the start of the video (before trimming the lead-in). */
  readonly at: number;
  readonly title: string;
  readonly caption: string;
}

/** A small deterministic PRNG, so two recordings of a script type the same way. */
function prng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const ease = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

export class Director {
  readonly marks: StepMark[] = [];
  /** When the video's first frame was recorded (page creation). */
  private readonly origin: number;
  /** The planned start of step 1: the lead-in before it is trimmed. */
  private start: number | null = null;
  private x = 720;
  private y = 450;
  private readonly random = prng(1815);
  private readonly lines: ConsoleLine[] = [];
  /** Steps that started later than planned, as warnings. */
  readonly late: string[] = [];
  /** Wall-clock time at which the director wrote its end mark. */
  ended: number | null = null;

  constructor(
    readonly page: Page,
    origin: number
  ) {
    this.origin = origin;
  }

  /** Seconds since the first frame. */
  now(): number {
    return (Date.now() - this.origin) / 1000;
  }

  /** Seconds since step 1 (the trimmed video's clock). */
  elapsed(): number {
    return this.start === null ? 0 : this.now() - this.start;
  }

  /** The lead-in to trim off: from the first frame to step 1. */
  leadIn(): number {
    return this.start ?? 0;
  }

  /**
   * A storyboard step: waits until `at` seconds into the video, then marks a chapter
   * with its caption. The first step starts the video's clock.
   */
  async step(at: number, title: string, caption: string): Promise<void> {
    if (this.start === null) {
      this.start = this.now();
    } else {
      const wait = at - this.elapsed();
      if (wait > 0) await this.page.waitForTimeout(wait * 1000);
      else if (wait < -0.5)
        this.late.push(
          `"${title}" started at ${this.elapsed().toFixed(1)} s, planned ${at} s`
        );
    }
    this.marks.push({ at: this.now(), title, caption });
  }

  /** Holds the frame until `at` seconds into the video: the end of the last step. */
  async end(at: number): Promise<void> {
    const wait = at - this.elapsed();
    if (wait > 0) await this.page.waitForTimeout(wait * 1000);
    this.ended = this.now();
  }

  async pause(ms: number): Promise<void> {
    await this.page.waitForTimeout(ms);
  }

  /** Moves the cursor along an eased path, at about 1.3 px/ms, 250 to 900 ms. */
  async moveTo(x: number, y: number): Promise<void> {
    const distance = Math.hypot(x - this.x, y - this.y);
    const duration = Math.min(900, Math.max(250, distance / 1.3));
    const frames = Math.max(8, Math.round(duration / 16));
    const fromX = this.x;
    const fromY = this.y;
    for (let i = 1; i <= frames; i++) {
      const t = ease(i / frames);
      await this.page.mouse.move(
        fromX + (x - fromX) * t,
        fromY + (y - fromY) * t
      );
      await this.page.waitForTimeout(duration / frames);
    }
    this.x = x;
    this.y = y;
  }

  /** Places the cursor without a visible move (at the start of a scene). */
  async placeCursor(x: number, y: number): Promise<void> {
    await this.page.mouse.move(x, y);
    this.x = x;
    this.y = y;
  }

  async moveToLocator(target: Locator): Promise<void> {
    await target.waitFor({ state: "visible" });
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox();
    if (!box) throw new Error("the target has no box");
    // Slightly off-centre, like a hand would land.
    const jitter = () => (this.random() - 0.5) * 0.3;
    await this.moveTo(
      box.x + box.width * (0.5 + jitter() * Math.min(1, 40 / box.width)),
      box.y + box.height * (0.5 + jitter() * 0.5)
    );
  }

  async click(target: Locator): Promise<void> {
    await this.moveToLocator(target);
    await this.pause(180);
    await this.page.mouse.down();
    await this.pause(70);
    await this.page.mouse.up();
    await this.pause(250);
  }

  /** Clicks the field, then types with a steady, slightly uneven rhythm. */
  async type(target: Locator, text: string): Promise<void> {
    await this.click(target);
    for (const char of text) {
      await this.page.keyboard.type(char);
      await this.page.waitForTimeout(45 + this.random() * 55);
    }
    await this.pause(200);
  }

  async press(key: string): Promise<void> {
    await this.page.keyboard.press(key);
    await this.pause(200);
  }

  /** Scrolls smoothly by `dy` pixels with the wheel. */
  async scroll(dy: number): Promise<void> {
    const steps = Math.max(6, Math.round(Math.abs(dy) / 40));
    for (let i = 0; i < steps; i++) {
      await this.page.mouse.wheel(0, dy / steps);
      await this.page.waitForTimeout(16);
    }
    await this.pause(300);
  }

  /** Adds a line to the agent console overlay (and shows it). */
  async agentSays(line: ConsoleLine): Promise<void> {
    this.lines.push(line);
    await this.showConsole();
  }

  async showConsole(): Promise<void> {
    const lines = this.lines.slice(-5);
    await this.page.evaluate((value) => window.__media?.console(value), lines);
  }

  /** The poster frame: a screenshot of this moment, without the cursor. */
  posterPng: Buffer | null = null;
  /** The same frame as JPEG, for a run without ffmpeg. */
  posterJpg: Buffer | null = null;

  async poster(): Promise<void> {
    const overlay = this.page.locator("#__media-overlay");
    await overlay.evaluate((host: HTMLElement) => {
      host.style.visibility = "hidden";
    });
    this.posterPng = await this.page.screenshot({ type: "png" });
    this.posterJpg = await this.page.screenshot({ type: "jpeg", quality: 80 });
    await overlay.evaluate((host: HTMLElement) => {
      host.style.visibility = "";
    });
  }

  async hideConsole(): Promise<void> {
    await this.page.evaluate(() => window.__media?.console(null));
  }
}
