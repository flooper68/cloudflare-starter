/**
 * The walkthrough player's markup, as a small element tree: one source for the Astro
 * component (VideoPlayer.astro renders the tree with MarkupNode.astro, no `set:html`) and
 * the docs kit's `::video` (src/docs/kit/render.ts, which serialises it with `toHtml`). The page works before and without its script: the poster, the chapters and
 * the transcript are plain HTML; video-player.ts (the `<walkthrough-video>` element)
 * plays it. No script, no inline style, no event handler attributes. Pure: tested in
 * player-markup.test.ts. docs/guides/how-to-record-walkthrough-videos.md#the-player
 */
import {
  formatDuration,
  type MediaEntry,
  spokenDuration,
} from "../../content/media";

export type MarkupAttrs = Readonly<Record<string, string | number | boolean>>;
export interface MarkupElement {
  readonly tag: string;
  readonly attrs: MarkupAttrs;
  readonly children: readonly MarkupChild[];
}
export type MarkupChild = MarkupElement | string;

function h(
  tag: string,
  attrs: MarkupAttrs = {},
  ...children: (MarkupChild | false | null | undefined)[]
): MarkupElement {
  return {
    tag,
    attrs,
    children: children.filter(
      (child): child is MarkupChild => typeof child === "string" || !!child
    ),
  };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const VOID = new Set(["img", "source", "track"]);

/** The tree as HTML (for the docs' Markdown): text and attribute values escaped. */
export function toHtml(node: MarkupChild): string {
  if (typeof node === "string") return escapeHtml(node);
  const attrs = Object.entries(node.attrs)
    .filter(([, value]) => value !== false)
    .map(([name, value]) =>
      value === true ? ` ${name}` : ` ${name}="${escapeHtml(String(value))}"`
    )
    .join("");
  if (VOID.has(node.tag)) return `<${node.tag}${attrs}>`;
  return `<${node.tag}${attrs}>${node.children.map(toHtml).join("")}</${node.tag}>`;
}

const svg = (size: number, ...children: MarkupElement[]) =>
  h(
    "svg",
    {
      viewBox: "0 0 24 24",
      width: size,
      height: size,
      "aria-hidden": "true",
      focusable: "false",
    },
    ...children
  );
const playIcon = (size: number) =>
  svg(size, h("path", { d: "M7 4.5v15l12.5-7.5z", fill: "currentColor" }));
const pauseIcon = () =>
  svg(
    16,
    h("rect", {
      x: 6,
      y: 4.5,
      width: 4,
      height: 15,
      rx: 1,
      fill: "currentColor",
    }),
    h("rect", {
      x: 14,
      y: 4.5,
      width: 4,
      height: 15,
      rx: 1,
      fill: "currentColor",
    })
  );
const strokeIcon = (...children: MarkupElement[]) =>
  h(
    "svg",
    {
      viewBox: "0 0 24 24",
      width: 12,
      height: 12,
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 2,
      "aria-hidden": "true",
      focusable: "false",
    },
    ...children
  );
const clockIcon = () =>
  strokeIcon(
    h("circle", { cx: 12, cy: 12, r: 9 }),
    h("path", { d: "M12 7v5l3 2" })
  );
const captionsIcon = () =>
  strokeIcon(
    h("rect", { x: 3, y: 5, width: 18, height: 14, rx: 2 }),
    h("path", { d: "M7 15h4M14 15h3M7 11h2M12 11h5" })
  );

/** The designed stand-in under the poster: shown when the poster cannot load. */
function fallback(title: string): MarkupElement {
  return h(
    "div",
    { class: "wv-fallback", "aria-hidden": "true" },
    h("span", { class: "wv-fallback-title" }, title),
    h("span", { class: "wv-fallback-bars" }, h("i"), h("i"))
  );
}

function sources(entry: MediaEntry): MarkupElement[] {
  return entry.sources.map((source) =>
    h("source", { src: source.src, type: source.type })
  );
}

function poster(entry: MediaEntry): MarkupElement {
  return h("img", {
    class: "wv-poster",
    src: entry.poster.src,
    alt: "",
    width: entry.width,
    height: entry.height,
    loading: "lazy",
    decoding: "async",
  });
}

/** A walkthrough: poster with Play, chapters beside it, captions on, the transcript. */
export function walkthroughTree(entry: MediaEntry): MarkupElement {
  const length = formatDuration(entry.duration);
  return h(
    "walkthrough-video",
    {
      class: "wv wv-walkthrough",
      role: "group",
      "aria-label": `Video: ${entry.title}`,
      // The site's analytics name the video by its id (video-player.ts).
      "data-video": entry.id,
    },
    h(
      "div",
      { class: "wv-stage" },
      fallback(entry.title),
      h(
        "video",
        {
          class: "wv-video",
          preload: "none",
          playsinline: true,
          width: entry.width,
          height: entry.height,
          "aria-label": entry.title,
          hidden: true,
        },
        ...sources(entry),
        entry.captions &&
          h("track", {
            kind: "captions",
            srclang: "en",
            label: "English",
            "data-src": entry.captions.src,
            default: true,
          })
      ),
      h(
        "div",
        { class: "wv-cover" },
        poster(entry),
        h(
          "button",
          {
            type: "button",
            class: "wv-play",
            "aria-label": `Play ${entry.title}, ${spokenDuration(entry.duration)}`,
          },
          playIcon(24)
        ),
        h(
          "span",
          { class: "wv-tags" },
          h("span", { class: "wv-tag" }, clockIcon(), length),
          entry.captions &&
            h("span", { class: "wv-tag" }, captionsIcon(), "Captions on"),
          h(
            "span",
            { class: "wv-tag" },
            entry.audio ? "Sound off until you unmute" : "No sound"
          )
        ),
        h("p", { class: "wv-missing", role: "status" })
      )
    ),
    h(
      "div",
      { class: "wv-side" },
      h("p", { class: "wv-title" }, entry.title),
      h(
        "p",
        { class: "wv-meta" },
        `${length} · ${entry.chapters.length} chapters`
      ),
      h(
        "ol",
        { class: "wv-chapters", "aria-label": "Chapters" },
        ...entry.chapters.map((chapter) =>
          h(
            "li",
            {},
            h(
              "button",
              {
                type: "button",
                class: "wv-chap",
                "data-start": chapter.start,
              },
              h("span", { class: "wv-t" }, formatDuration(chapter.start)),
              h("span", {}, chapter.title)
            )
          )
        )
      ),
      h(
        "details",
        { class: "wv-transcript" },
        h("summary", {}, "Read the transcript"),
        h(
          "ol",
          {},
          ...entry.chapters.map((chapter) =>
            h(
              "li",
              {},
              h("span", { class: "wv-t" }, formatDuration(chapter.start)),
              h("span", {}, chapter.caption)
            )
          )
        )
      )
    )
  );
}

/**
 * A muted loop: plays while in view, pauses off screen, a pause button always there.
 * Under reduced motion it waits on its poster with a Play button.
 */
export function loopTree(entry: MediaEntry): MarkupElement {
  return h(
    "walkthrough-video",
    { class: "wv wv-loop", "data-loop": true, "data-video": entry.id },
    h(
      "div",
      { class: "wv-stage" },
      fallback(entry.title),
      h(
        "video",
        {
          class: "wv-video",
          muted: true,
          loop: true,
          playsinline: true,
          preload: "none",
          width: entry.width,
          height: entry.height,
          "aria-label": `${entry.title}, a muted clip`,
        },
        ...sources(entry)
      ),
      poster(entry),
      h("span", { class: "wv-chip" }, entry.title),
      h(
        "button",
        {
          type: "button",
          class: "wv-toggle",
          "aria-label": `Play clip: ${entry.title}`,
        },
        h("span", { class: "wv-icon-play" }, playIcon(16)),
        h("span", { class: "wv-icon-pause" }, pauseIcon())
      )
    )
  );
}

/** The stand-in for a video that is not recorded yet. */
export function comingSoonTree(title: string): MarkupElement {
  return h(
    "div",
    { class: "wv wv-soon" },
    h(
      "div",
      { class: "wv-stage" },
      fallback(title),
      h("span", { class: "wv-chip" }, playIcon(16), "Clip coming soon")
    )
  );
}

export function playerTree(
  entry: MediaEntry | undefined,
  fallbackTitle: string
): MarkupElement {
  if (!entry) return comingSoonTree(fallbackTitle);
  return entry.kind === "loop" ? loopTree(entry) : walkthroughTree(entry);
}

export const walkthroughHtml = (entry: MediaEntry) =>
  toHtml(walkthroughTree(entry));
export const loopHtml = (entry: MediaEntry) => toHtml(loopTree(entry));
export const playerHtml = (
  entry: MediaEntry | undefined,
  fallbackTitle: string
) => toHtml(playerTree(entry, fallbackTitle));
