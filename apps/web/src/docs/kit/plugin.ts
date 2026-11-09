/**
 * The docs components kit as Sätteri Markdown plugins (astro.config.mjs). Writers use
 * generic Markdown directives, which read fine as text on GitHub; the site renders them
 * to static HTML at build time (render.ts). Two passes: the one-line directives first
 * (`::flow`, `::shot`, `::video`, `::before`, `::after`, `::reviewed`), then the blocks
 * (`:::screenshot`, `:::steps`, `:::compare`, `:::settings`, `:::decision`, `:::gotcha`,
 * `:::tabs`, `:::prompt`, `:::byhand`). An unknown directive, a bad attribute or a
 * missing screenshot fails the build.
 *
 * Screenshots stay Markdown images, so Astro processes and fingerprints them like any
 * other docs image (and fails on a missing file).
 * docs/reference/docs-site.md#docs-components
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import type { SatteriProcessorOptions } from "@astrojs/markdown-satteri";

import {
  EMPTY_MEDIA,
  isVideoId,
  MEDIA_MANIFEST,
  type MediaManifest,
} from "./media";
import {
  byHandHtml,
  type Callout,
  type CalloutKind,
  calloutHtml,
  compareHtml,
  compareSideHtml,
  flowHtml,
  markersHtml,
  parseCalloutPrefix,
  parseSetting,
  promptHtml,
  reviewedHtml,
  settingsHtml,
  tabLabel,
  tabsHtml,
  variantOpen,
  videoPlaceholderHtml,
  videoPlayerHtml,
  videoPosterHtml,
} from "./render";
import {
  EMPTY_MANIFEST,
  isShotId,
  SCREENS_DIR,
  SCREENS_MANIFEST,
  type ScreensManifest,
  shotVariants,
} from "./shots";

type MdastPluginEntry = NonNullable<
  SatteriProcessorOptions["mdastPlugins"]
>[number];

// Loose node shapes: the visitor hands out mdast nodes (types in satteri/mdast).
interface MdNode {
  readonly type: string;
  readonly name?: string;
  readonly attributes?: Record<string, string | null | undefined> | null;
  readonly children?: readonly MdNode[];
  readonly value?: string;
  readonly lang?: string | null;
  readonly meta?: string | null;
  readonly ordered?: boolean | null;
  readonly position?: { start: { offset?: number }; end: { offset?: number } };
}

interface Ctx {
  readonly source: string;
  replaceNode(node: unknown, content: unknown): void;
  textContent(node: unknown): string;
}

type Content = Record<string, unknown>;

const raw = (html: string): Content => ({ raw: html, mdxExpressions: false });

function readJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function attr(node: MdNode, name: string): string | undefined {
  const value = node.attributes?.[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function where(from: string, node: MdNode): string {
  return `${from}: ${node.type === "containerDirective" ? ":::" : "::"}${node.name}`;
}

/** The context the plugins share for one document. */
interface Doc {
  readonly from: string;
  readonly root: string;
  readonly shots: ScreensManifest;
  readonly media: MediaManifest;
}

function docFor(repoRoot: URL, fileURL: URL | undefined): Doc | null {
  if (!fileURL) return null;
  const root = fileURLToPath(repoRoot);
  const from = relative(root, fileURLToPath(fileURL)).split(sep).join("/");
  if (from.startsWith("..")) return null;
  return {
    from,
    root,
    // Read per document: `astro dev` picks up a new capture without a restart.
    shots: readJson(join(root, SCREENS_MANIFEST), EMPTY_MANIFEST),
    media: readJson(join(root, MEDIA_MANIFEST), EMPTY_MEDIA),
  };
}

/** The URL of a screenshot file, relative to the doc, as Markdown images use. */
function shotUrl(doc: Doc, file: string): string {
  const path = relative(
    dirname(join(doc.root, doc.from)),
    join(doc.root, SCREENS_DIR, file)
  )
    .split(sep)
    .join("/");
  return path.startsWith(".") ? path : `./${path}`;
}

const imageParagraph = (url: string, alt: string): Content => ({
  type: "paragraph",
  children: [{ type: "image", url, alt }],
});

/**
 * The images of a shot, one frame per variant (CSS shows the one for the theme and
 * viewport), each with its markers.
 */
function shotFrames(
  doc: Doc,
  id: string,
  alt: string,
  markers: (callouts: readonly (Callout | null)[]) => string
): Content[] {
  return shotVariants(doc.shots, id).flatMap(({ variant, image }) => [
    raw(variantOpen(variant)),
    imageParagraph(shotUrl(doc, image.file), alt),
    raw(`${markers(image.callouts)}</div>`),
  ]);
}

// ---------------------------------------------------------------------------------------
// Pass 1: one-line directives (and text directives, which are not ours)

function leafPass(repoRoot: URL): MdastPluginEntry {
  return ({ fileURL }) => {
    const doc = docFor(repoRoot, fileURL);
    if (!doc) return null;
    return {
      name: "docs-kit-leaf",
      options: { position: true },
      // `a:b` or `10:30` in prose parses as a text directive: put the text back.
      textDirective(node: MdNode, ctx: Ctx) {
        const start = node.position?.start.offset;
        const end = node.position?.end.offset;
        const text =
          start !== undefined && end !== undefined
            ? ctx.source.slice(start, end)
            : `:${node.name ?? ""}`;
        ctx.replaceNode(node, { type: "text", value: text });
      },
      leafDirective(node: MdNode, ctx: Ctx) {
        ctx.replaceNode(node, leaf(doc, node, ctx));
      },
    } as never;
  };
}

function leaf(doc: Doc, node: MdNode, ctx: Ctx): Content | Content[] {
  const label = ctx.textContent(node).trim();
  switch (node.name) {
    case "flow":
      return raw(flowHtml(label, attr(node, "title")));
    case "shot": {
      const id = attr(node, "id");
      if (!id || !isShotId(id))
        throw new Error(`${where(doc.from, node)} needs id="<screenshot id>"`);
      const alt = attr(node, "alt") ?? doc.shots.shots[id]?.alt ?? "";
      if (!alt) throw new Error(`${where(doc.from, node)} needs alt text`);
      return [
        raw('<div class="dk-shot" data-plain="">'),
        ...shotFrames(doc, id, alt, () => ""),
        raw("</div>"),
      ];
    }
    case "video": {
      const id = attr(node, "id");
      if (!id || !isVideoId(id))
        throw new Error(`${where(doc.from, node)} needs id="<video id>"`);
      const title = attr(node, "title") ?? label;
      if (!title) throw new Error(`${where(doc.from, node)} needs a title`);
      const media = doc.media.videos[id];
      if (media) return raw(videoPlayerHtml(title, media));
      const poster = attr(node, "poster");
      if (!poster) return raw(videoPlaceholderHtml(title));
      const { open, close } = videoPosterHtml(title);
      const alt = `Video coming soon: ${title}`;
      return [raw(open), ...shotFrames(doc, poster, alt, () => ""), raw(close)];
    }
    case "before":
    case "after": {
      const { open, close } = compareSideHtml(node.name);
      return [
        raw(open),
        { type: "paragraph", children: node.children ?? [] },
        raw(close),
      ];
    }
    case "reviewed": {
      const date = attr(node, "date");
      if (!date)
        throw new Error(`${where(doc.from, node)} needs date="YYYY-MM-DD"`);
      return raw(reviewedHtml(date));
    }
    default:
      throw new Error(`${where(doc.from, node)}: unknown docs component`);
  }
}

// ---------------------------------------------------------------------------------------
// Pass 2: blocks

function containerPass(repoRoot: URL): MdastPluginEntry {
  return ({ fileURL }) => {
    const doc = docFor(repoRoot, fileURL);
    if (!doc) return null;
    // Ids must be unique on the page.
    let tabs = 0;
    const nextTabs = () => `dk-tabs-${++tabs}`;
    return {
      name: "docs-kit-blocks",
      containerDirective(node: MdNode, ctx: Ctx) {
        ctx.replaceNode(node, block(doc, node, ctx, nextTabs));
      },
    } as never;
  };
}

function wrap(
  html: { open: string; close: string },
  children: readonly MdNode[]
): Content[] {
  return [
    raw(html.open),
    ...(children as unknown as Content[]),
    raw(html.close),
  ];
}

function block(
  doc: Doc,
  node: MdNode,
  ctx: Ctx,
  nextTabs: () => string
): Content[] {
  const children = node.children ?? [];
  switch (node.name) {
    case "decision":
    case "gotcha": {
      const title = attr(node, "title");
      if (!title) throw new Error(`${where(doc.from, node)} needs title="…"`);
      return wrap(calloutHtml(node.name as CalloutKind, title), children);
    }
    case "byhand":
      return wrap(
        byHandHtml(attr(node, "title") ?? "Doing it by hand"),
        children
      );
    case "prompt":
      return wrap(
        promptHtml(attr(node, "title") ?? "Paste this into your coding agent"),
        children
      );
    case "compare":
      return wrap(compareHtml(), children);
    case "steps": {
      const list = children[0];
      if (children.length !== 1 || list?.type !== "list" || !list.ordered)
        throw new Error(
          `${where(doc.from, node)} holds one numbered list (1. 2. 3.)`
        );
      return wrap(
        { open: '<div class="dk-steps">', close: "</div>" },
        children
      );
    }
    case "settings": {
      const list = children[0];
      if (children.length !== 1 || list?.type !== "list")
        throw new Error(
          `${where(doc.from, node)} holds one list of NAME = default (a | b) description`
        );
      const settings = (list.children ?? []).map((item) =>
        parseSetting(ctx.textContent(item))
      );
      return [raw(settingsHtml(settings))];
    }
    case "tabs": {
      if (
        children.length < 2 ||
        children.some((child) => child.type !== "code")
      )
        throw new Error(
          `${where(doc.from, node)} holds only code blocks, at least two`
        );
      const html = tabsHtml(
        nextTabs(),
        children.map((child) => tabLabel(child.meta, child.lang))
      );
      return [
        raw(html.open),
        ...children.flatMap((child, index) => [
          raw(html.panelOpen(index)),
          child as unknown as Content,
          raw(html.panelClose),
        ]),
        raw(html.close),
      ];
    }
    case "screenshot":
      return screenshot(doc, node);
    default:
      throw new Error(`${where(doc.from, node)}: unknown docs component`);
  }
}

/**
 * `:::screenshot{shot="id" alt="…"}` (or `src="path"`) with an optional list of callouts:
 * each item is one numbered marker, in order. With `shot`, the positions come from the
 * manifest (element locators at capture time); a `(x%, y%)` prefix overrides one.
 */
function screenshot(doc: Doc, node: MdNode): Content[] {
  const children = node.children ?? [];
  const list = children[0];
  if (children.length > 1 || (list && list.type !== "list"))
    throw new Error(
      `${where(doc.from, node)} holds at most one list of callouts`
    );
  const items = list?.children ?? [];
  const overrides: (Callout | null)[] = [];
  const legend = items.map((item) => {
    const paragraph = item.children?.[0];
    const first = paragraph?.children?.[0];
    const parsed =
      first?.type === "text" ? parseCalloutPrefix(first.value ?? "") : null;
    overrides.push(parsed?.at ?? null);
    if (!parsed || !paragraph) return item as unknown as Content;
    return {
      type: "listItem",
      spread: false,
      children: [
        {
          type: "paragraph",
          children: [
            { type: "text", value: parsed.rest },
            ...(paragraph.children ?? []).slice(1),
          ],
        },
        ...(item.children ?? []).slice(1),
      ],
    };
  });
  const id = attr(node, "shot");
  const src = attr(node, "src");
  const alt = attr(node, "alt") ?? (id ? doc.shots.shots[id]?.alt : undefined);
  if (!alt) throw new Error(`${where(doc.from, node)} needs alt text`);
  const positions = (
    measured: readonly (Callout | null)[]
  ): (Callout | null)[] =>
    overrides.map((override, index) => {
      if (override) return override;
      const at = measured[index];
      if (at === undefined)
        throw new Error(
          `${where(doc.from, node)}: callout ${index + 1} has no position (give "(x%, y%)" or a locator in apps/web/test/screens/shots.ts)`
        );
      return at;
    });
  let frames: Content[];
  if (id) {
    if (!isShotId(id))
      throw new Error(`${where(doc.from, node)}: bad shot id "${id}"`);
    frames = shotFrames(doc, id, alt, (measured) =>
      markersHtml(positions(measured))
    );
  } else if (src) {
    frames = [
      raw('<div class="dk-shot-frame" data-variant="any">'),
      imageParagraph(src, alt),
      raw(`${markersHtml(positions([]))}</div>`),
    ];
  } else {
    throw new Error(
      `${where(doc.from, node)} needs shot="<id>" or src="<image>"`
    );
  }
  const caption =
    items.length > 0
      ? [
          raw('<figcaption class="dk-shot-legend">'),
          {
            type: "list",
            ordered: true,
            start: 1,
            spread: false,
            children: legend,
          },
          raw("</figcaption>"),
        ]
      : [];
  return [
    raw('<figure class="dk-shot">'),
    ...frames,
    ...caption,
    raw("</figure>"),
  ];
}

/** Both passes, in order. */
export function docsKitPlugins(repoRoot: URL): MdastPluginEntry[] {
  return [leafPass(repoRoot), containerPass(repoRoot)];
}
