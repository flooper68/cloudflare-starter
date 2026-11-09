import type { Page } from "@playwright/test";

import type { DemoAgent } from "../lib/agent";
import type { Director } from "../lib/director";
import type { SeedResult } from "../lib/seed";

export interface RecordingContext {
  readonly d: Director;
  readonly page: Page;
  readonly baseURL: string;
  readonly seed: SeedResult;
  /** A new "Demo MCP client", acting through this page's browser session. */
  agent(): DemoAgent;
}

/**
 * One recorded video. Its id, title and kind come from src/content/videos.ts (same
 * id); `record` drives the page with the Director: everything before the first
 * `d.step()` is the lead-in and is cut, the last `d.end()` is the end.
 */
export interface VideoScript {
  readonly id: string;
  /** Start with Ada's session (otherwise signed out). */
  readonly signedIn: boolean;
  /** 1440×900 unless set. */
  readonly viewport?: { readonly width: number; readonly height: number };
  record(context: RecordingContext): Promise<void>;
}
