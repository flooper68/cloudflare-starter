/**
 * WebVTT from a storyboard: each step's caption is one cue, from the step's start to the
 * next step's (or the end of the video). Pure, so it is unit tested.
 */

export interface TimedStep {
  /** Seconds from the start of the (trimmed) video. */
  readonly start: number;
  readonly title: string;
  readonly caption: string;
}

/** `75.5` → `00:01:15.500`. */
export function vttTime(seconds: number): string {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const rest = ms % 1000;
  const pad = (value: number, size = 2) => String(value).padStart(size, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(rest, 3)}`;
}

/** Cue text may not contain `-->` or a blank line; `&` and `<` are escaped. */
function cueText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/-->/g, "→")
    .replace(/\n\s*\n/g, "\n")
    .trim();
}

/** The captions track: one cue per step, its caption. */
export function captionsVtt(
  steps: readonly TimedStep[],
  duration: number
): string {
  const sorted = [...steps].sort((a, b) => a.start - b.start);
  const blocks = sorted.map((step, index) => {
    const end = Math.min(sorted[index + 1]?.start ?? duration, duration);
    return `${index + 1}\n${vttTime(step.start)} --> ${vttTime(end)}\n${cueText(step.caption)}`;
  });
  return `WEBVTT\n\n${blocks.join("\n\n")}\n`;
}
