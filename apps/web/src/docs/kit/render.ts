/**
 * The docs components kit, as pure functions: each turns a directive's text into the
 * static HTML the docs site shows (markdown-plugins.ts `docsKitPlugin` calls them while
 * it renders Markdown). No DOM, no Astro, so the plugin, the tests and the screenshot
 * pipeline share them. Only the tabs and the copy button get script (docs-kit.ts).
 *
 * The HTML is spliced into the Markdown as raw blocks, so every fragment here is ONE line
 * (a blank line would end the HTML block) and every text is escaped.
 * Syntax and examples: docs/reference/docs-site.md#docs-components
 */
import { diagramHtml } from "../diagrams";

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Icons (Lucide paths), decorative: the text next to them carries the meaning. */
const ICONS = {
  decision:
    '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>',
  gotcha:
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  before:
    '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  after: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  prompt:
    '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  hand: '<path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>',
} as const;

export type IconName = keyof typeof ICONS;

export function icon(name: IconName, className = "dk-icon"): string {
  return `<svg class="${className}" aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
}

// ---------------------------------------------------------------------------------------
// Callouts: decision and gotcha

export type CalloutKind = "decision" | "gotcha";

const CALLOUT_LABEL: Record<CalloutKind, string> = {
  decision: "Decision",
  gotcha: "Gotcha",
};

/** The opening and closing HTML around a callout's Markdown body. */
export function calloutHtml(
  kind: CalloutKind,
  title: string
): { open: string; close: string } {
  const label = CALLOUT_LABEL[kind];
  return {
    open: `<aside class="dk-callout" data-kind="${kind}" aria-label="${escapeHtml(`${label}: ${title}`)}"><p class="dk-callout-title">${icon(kind)}<span><span class="dk-callout-kind">${label}</span> · ${escapeHtml(title)}</span></p><div class="dk-callout-body">`,
    close: "</div></aside>",
  };
}

// ---------------------------------------------------------------------------------------
// Doing it by hand, and the one prompt

/** A collapsed section for the manual steps. Native <details>: no script. */
export function byHandHtml(title: string): { open: string; close: string } {
  return {
    open: `<details class="dk-byhand"><summary>${icon("hand")}<span>${escapeHtml(title)}</span></summary><div class="dk-byhand-body">`,
    close: "</div></details>",
  };
}

/**
 * The one prompt to paste into a coding agent: a labelled block with a copy button. The
 * button is hidden until docs-kit.ts enables it (no script, no button).
 */
export function promptHtml(title: string): { open: string; close: string } {
  return {
    open: `<section class="dk-prompt" aria-label="${escapeHtml(title)}"><div class="dk-prompt-head"><p class="dk-prompt-title">${icon("prompt")}<span>${escapeHtml(title)}</span></p><button type="button" class="dk-copy" data-dk-copy="" hidden>${icon("copy")}<span data-dk-copy-label="" aria-live="polite">Copy prompt</span></button></div>`,
    close: "</section>",
  };
}

// ---------------------------------------------------------------------------------------
// Before and after

export function compareHtml(): { open: string; close: string } {
  return { open: '<div class="dk-compare">', close: "</div>" };
}

export function compareSideHtml(side: "before" | "after"): {
  open: string;
  close: string;
} {
  const label = side === "before" ? "Before" : "After";
  return {
    open: `<div class="dk-compare-side" data-side="${side}"><p class="dk-compare-label">${icon(side)}<span>${label}</span></p><div class="dk-compare-body">`,
    close: "</div></div>",
  };
}

// ---------------------------------------------------------------------------------------
// Settings as cards

export interface Setting {
  readonly name: string;
  readonly value: string;
  readonly values: readonly string[];
  readonly description: string;
}

/**
 * One settings line: `NAME = default (a | b | c) What it does`. The values list is
 * optional (`NAME = 30 Days kept`); the default must be one of the values when given.
 */
export function parseSetting(line: string): Setting {
  const match =
    /^\s*([A-Za-z_][\w.-]*)\s*=\s*(\S+)\s*(?:\(([^)]*)\))?\s*(.*)$/.exec(line);
  if (!match)
    throw new Error(
      `Docs settings line "${line}" is not "NAME = default (a | b) description"`
    );
  const [, name, value, list, description] = match;
  const values = list
    ? list
        .split("|")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];
  if (values.length > 0 && !values.includes(value))
    throw new Error(
      `Docs setting ${name}: the default "${value}" is not one of ${values.join(", ")}`
    );
  return { name, value, values, description: description.trim() };
}

export function settingsHtml(settings: readonly Setting[]): string {
  if (settings.length === 0)
    throw new Error("A :::settings block needs at least one setting");
  const cards = settings.map((setting) => {
    const chips =
      setting.values.length > 0
        ? `<ul class="dk-setting-values" aria-label="Values">${setting.values
            .map((entry) =>
              entry === setting.value
                ? `<li data-default=""><code>${escapeHtml(entry)}</code><span class="dk-sr"> (default)</span></li>`
                : `<li><code>${escapeHtml(entry)}</code></li>`
            )
            .join("")}</ul>`
        : "";
    return `<li class="dk-setting"><p class="dk-setting-name"><code>${escapeHtml(setting.name)}</code></p><p class="dk-setting-desc">${escapeHtml(setting.description)}</p><p class="dk-setting-default">Default <code>${escapeHtml(setting.value)}</code></p>${chips}</li>`;
  });
  return `<ul class="dk-settings" aria-label="Settings">${cards.join("")}</ul>`;
}

// ---------------------------------------------------------------------------------------
// Tabs

export interface Tab {
  readonly id: string;
  readonly label: string;
}

/** The tab label of a code block: its `title="…"` meta, else its language. */
export function tabLabel(
  meta: string | null | undefined,
  lang: string | null | undefined
): string {
  const title = /title="([^"]+)"/.exec(meta ?? "")?.[1];
  const label = title ?? lang ?? "";
  if (!label.trim())
    throw new Error(
      'Each code block in :::tabs needs a title="…" or a language'
    );
  return label.trim();
}

/**
 * The tab list and the panel wrappers. Without script every panel shows, each under its
 * label (the tab list stays hidden); docs-kit.ts turns it into ARIA tabs.
 */
export function tabsHtml(
  prefix: string,
  labels: readonly string[]
): {
  open: string;
  panelOpen: (index: number) => string;
  panelClose: string;
  close: string;
} {
  if (labels.length < 2)
    throw new Error("A :::tabs block needs at least two code blocks");
  const tabs: Tab[] = labels.map((label, index) => ({
    id: `${prefix}-${index + 1}`,
    label,
  }));
  const list = tabs
    .map(
      (tab, index) =>
        `<button type="button" role="tab" id="${tab.id}-tab" aria-controls="${tab.id}" aria-selected="${index === 0}" tabindex="${index === 0 ? 0 : -1}">${escapeHtml(tab.label)}</button>`
    )
    .join("");
  return {
    open: `<div class="dk-tabs" data-dk-tabs=""><div class="dk-tablist" role="tablist" aria-label="Choose how" hidden>${list}</div>`,
    panelOpen: (index) => {
      const tab = tabs[index];
      return `<div class="dk-tabpanel" role="tabpanel" id="${tab.id}" aria-labelledby="${tab.id}-tab"><p class="dk-tabpanel-label">${escapeHtml(tab.label)}</p>`;
    },
    panelClose: "</div>",
    close: "</div>",
  };
}

// ---------------------------------------------------------------------------------------
// Flow diagram: an SVG through the diagram pipeline (diagrams.ts)

/** `A -> B -> C` into its steps. */
export function parseFlow(text: string): string[] {
  const steps = text
    .split(/\s*(?:->|→)\s*/)
    .map((step) => step.trim())
    .filter(Boolean);
  if (steps.length < 2 || steps.length > 7)
    throw new Error(`A flow needs 2 to 7 steps, separated by "->": "${text}"`);
  return steps;
}

const FLOW_STYLE =
  "<style>.dk-f-box{fill:var(--ui-surface-raised,#ffffff);stroke:var(--ui-line-strong,#d0d7de);stroke-width:1}" +
  ".dk-f-key{fill:var(--ui-accent-subtle,#e0f2ef);stroke:var(--ui-accent,#0f766e);stroke-width:1.5}" +
  ".dk-f-t{fill:var(--ui-fg,#1f2328);font:600 13px var(--brand-font-sans, ui-sans-serif, system-ui, sans-serif)}" +
  ".dk-f-n{fill:var(--ui-fg-muted,#59636e);font:600 10px var(--brand-font-sans, ui-sans-serif, system-ui, sans-serif);letter-spacing:.06em}" +
  ".dk-f-a{stroke:var(--ui-fg-subtle,#818b98);stroke-width:1.5;fill:none}" +
  ".dk-f-ah{fill:var(--ui-fg-subtle,#818b98)}" +
  "@media (prefers-color-scheme:dark){.dk-f-box{fill:var(--ui-surface-raised,#161b22);stroke:var(--ui-line-strong,#3d444d)}" +
  ".dk-f-key{fill:var(--ui-accent-subtle,#0f2e2b);stroke:var(--ui-accent,#2dd4bf)}" +
  ".dk-f-t{fill:var(--ui-fg,#f0f6fc)}.dk-f-n{fill:var(--ui-fg-muted,#9198a1)}" +
  ".dk-f-a{stroke:var(--ui-fg-subtle,#8b949e)}.dk-f-ah{fill:var(--ui-fg-subtle,#8b949e)}}</style>";

/** Rough text width at 13px semibold: enough to size the boxes without a font. */
function textWidth(text: string): number {
  return Math.ceil(text.length * 7.4);
}

/**
 * The flow as an SVG in one orientation: a row of boxes (wide screens) or a column
 * (phones). The first and last steps are highlighted.
 */
export function flowSvg(
  steps: readonly string[],
  title: string,
  orientation: "row" | "column"
): string {
  const boxH = 52;
  const gap = orientation === "row" ? 36 : 28;
  const widths = steps.map((step) => Math.max(96, textWidth(step) + 32));
  const parts: string[] = [];
  let width: number;
  let height: number;
  if (orientation === "row") {
    width =
      widths.reduce((sum, w) => sum + w, 0) + gap * (steps.length - 1) + 4;
    height = boxH + 24;
    let x = 2;
    steps.forEach((step, index) => {
      const w = widths[index];
      const key = index === 0 || index === steps.length - 1;
      parts.push(
        `<rect class="${key ? "dk-f-key" : "dk-f-box"}" x="${x}" y="12" width="${w}" height="${boxH}" rx="10"/>`,
        `<text class="dk-f-n" x="${x + w / 2}" y="31" text-anchor="middle">${index + 1}</text>`,
        `<text class="dk-f-t" x="${x + w / 2}" y="50" text-anchor="middle">${escapeHtml(step)}</text>`
      );
      if (index < steps.length - 1) {
        const ax = x + w + 4;
        const bx = x + w + gap - 6;
        parts.push(
          `<path class="dk-f-a" d="M${ax} 38H${bx}"/>`,
          `<path class="dk-f-ah" d="M${bx + 4} 38l-6-4v8z"/>`
        );
      }
      x += w + gap;
    });
  } else {
    width = Math.max(...widths) + 4;
    height = steps.length * boxH + (steps.length - 1) * gap + 4;
    let y = 2;
    steps.forEach((step, index) => {
      const key = index === 0 || index === steps.length - 1;
      parts.push(
        `<rect class="${key ? "dk-f-key" : "dk-f-box"}" x="2" y="${y}" width="${width - 4}" height="${boxH}" rx="10"/>`,
        `<text class="dk-f-n" x="${width / 2}" y="${y + 19}" text-anchor="middle">${index + 1}</text>`,
        `<text class="dk-f-t" x="${width / 2}" y="${y + 38}" text-anchor="middle">${escapeHtml(step)}</text>`
      );
      if (index < steps.length - 1) {
        const ay = y + boxH + 3;
        const by = y + boxH + gap - 6;
        parts.push(
          `<path class="dk-f-a" d="M${width / 2} ${ay}V${by}"/>`,
          `<path class="dk-f-ah" d="M${width / 2} ${by + 4}l-4-6h8z"/>`
        );
      }
      y += boxH + gap;
    });
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" class="dk-flow-${orientation}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(title)}"><title>${escapeHtml(title)}</title>${FLOW_STYLE}${parts.join("")}</svg>`;
}

/**
 * The flow diagram: both orientations through diagramHtml (the #57 diagram pipeline's
 * checks and figure), CSS shows one. The hidden one is display:none, so a screen reader
 * hears the flow once.
 */
export function flowHtml(text: string, title?: string): string {
  const steps = parseFlow(text);
  const label = title?.trim() || `Flow: ${steps.join(", then ")}`;
  const row = diagramHtml("flow.svg", flowSvg(steps, label, "row"), label);
  const column = diagramHtml(
    "flow.svg",
    flowSvg(steps, label, "column"),
    label
  );
  // One figure: take the row's opening tag, then both SVGs.
  const open = row.slice(0, row.indexOf("<svg"));
  const rowSvg = row.slice(row.indexOf("<svg"), -"</figure>".length);
  const columnSvg = column.slice(column.indexOf("<svg"), -"</figure>".length);
  return (
    open.replace("<figure ", '<figure class="dk-flow" ') +
    rowSvg +
    columnSvg +
    "</figure>"
  );
}

// ---------------------------------------------------------------------------------------
// Screenshots

export interface Callout {
  /** Percent of the image's width and height, 0 to 100. */
  readonly x: number;
  readonly y: number;
}

/** `(74%, 36%) Label` → the position and the rest; no prefix → null. */
export function parseCalloutPrefix(
  text: string
): { readonly at: Callout; readonly rest: string } | null {
  const match = /^\s*\(\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)\s*/.exec(text);
  if (!match) return null;
  const x = Number(match[1]);
  const y = Number(match[2]);
  if (!(x >= 0 && x <= 100 && y >= 0 && y <= 100))
    throw new Error(
      `Callout position (${match[1]}%, ${match[2]}%) is outside the image`
    );
  return { at: { x, y }, rest: text.slice(match[0].length) };
}

/** The numbered markers over one image. Decorative: the list under it says the same. */
export function markersHtml(callouts: readonly (Callout | null)[]): string {
  return callouts
    .map((at, index) =>
      at === null
        ? ""
        : `<span class="dk-marker" aria-hidden="true" style="left:${round(at.x)}%;top:${round(at.y)}%">${index + 1}</span>`
    )
    .join("");
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Which theme or viewport an image shows in: CSS picks one per page. */
export type ShotVariant = "dark" | "light" | "phone-dark" | "phone-light";

export function variantOpen(variant: ShotVariant): string {
  return `<div class="dk-shot-frame" data-variant="${variant}">`;
}

// ---------------------------------------------------------------------------------------
// Video slot

export interface MediaEntry {
  readonly src: string;
  readonly poster?: string;
  readonly captions?: string;
  readonly chapters?: string;
  readonly title?: string;
  /** "1:15" */
  readonly duration?: string;
}

/**
 * The video when the media manifest has it: a native player with captions and chapters
 * (the video PR's player component replaces this markup). No autoplay, no preload.
 */
export function videoPlayerHtml(title: string, media: MediaEntry): string {
  const tracks = [
    media.captions
      ? `<track kind="captions" src="${escapeHtml(media.captions)}" srclang="en" label="English" default>`
      : "",
    media.chapters
      ? `<track kind="chapters" src="${escapeHtml(media.chapters)}" srclang="en">`
      : "",
  ].join("");
  const poster = media.poster ? ` poster="${escapeHtml(media.poster)}"` : "";
  const length = media.duration ? ` · ${escapeHtml(media.duration)}` : "";
  return `<figure class="dk-video" data-state="ready"><video controls preload="none" playsinline${poster} src="${escapeHtml(media.src)}" aria-label="${escapeHtml(`Video: ${title}`)}">${tracks}</video><figcaption class="dk-video-caption"><strong>${escapeHtml(title)}</strong>${length}</figcaption></figure>`;
}

/** The poster until the video exists: its opening (the poster image follows) and close. */
export function videoPosterHtml(title: string): {
  open: string;
  close: string;
} {
  return {
    open: `<figure class="dk-video" data-state="soon"><div class="dk-video-stage">`,
    close: `<div class="dk-video-overlay" aria-hidden="true"><span class="dk-video-play">${icon("play", "dk-icon-lg")}</span></div></div><figcaption class="dk-video-caption"><strong>${escapeHtml(title)}</strong><span class="dk-badge">Video coming soon</span></figcaption></figure>`,
  };
}

/** The poster without a screenshot: a designed placeholder. */
export function videoPlaceholderHtml(title: string): string {
  const { open, close } = videoPosterHtml(title);
  return `${open}<div class="dk-video-blank"></div>${close}`;
}

// ---------------------------------------------------------------------------------------
// Last reviewed

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function reviewedHtml(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match)
    throw new Error(`::reviewed needs date="YYYY-MM-DD", got "${date}"`);
  const [, year, month, day] = match;
  const text = `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
  return `<p class="dk-reviewed">Last reviewed <time datetime="${date}">${text}</time></p>`;
}
