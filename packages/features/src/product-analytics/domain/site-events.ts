import { z } from "zod";

import { defineEvent } from "../../kernel";

/**
 * Events of the public pages (the landing page, the docs, the auth pages), sent
 * anonymously by the browser through `POST /api/site-events` (`site: true`). No cookie,
 * no visitor id and no user: each event stands alone, so the public steps of the funnel
 * count events, not people. Values are ids the pages define (`hero`, `guides`), never
 * text a visitor typed. docs/reference/product-analytics.md#site-events
 */

/** A short id the page defines: `home`, `hero`, `copy_prompt`, `guides`. */
export const siteId = z
  .string()
  .min(1)
  .max(48)
  .regex(/^[a-z0-9][a-z0-9_-]*$/, "a lowercase id, not free text");

/** Where a visit came from: the referring site's host only, never its path or query. */
const referrerHost = z
  .string()
  .max(100)
  .regex(/^[a-z0-9.-]*$/, "a host name only");

/** `utm_source` of the landing URL, lowercased; '' without one. */
const utmSource = z
  .string()
  .max(64)
  .regex(/^[a-z0-9._-]*$/, "a lowercase source id");

/** Whether the view starts a visit: no referrer from this site. */
export const SITE_ENTRY_VALUES = ["yes", "no"] as const;

/**
 * A public page was shown. `page` is the page kind (`home`, `docs`, `changelog`,
 * `sign_up`), never the URL; `entry` says whether it started a visit (the referrer is not
 * this site), and only then do `referrer_host` and `utm_source` say where it came from.
 */
export const sitePageViewedEvent = defineEvent(
  "site.page_viewed",
  { strings: ["page", "entry", "referrer_host", "utm_source"], numbers: [] },
  z
    .object({
      page: siteId,
      entry: z.enum(SITE_ENTRY_VALUES),
      referrer_host: referrerHost,
      utm_source: utmSource,
    })
    .strict(),
  {
    client: false,
    site: true,
    description:
      "A public page was shown: its kind, whether it started a visit, and the referring host",
  }
);

/** How far down the page a visitor scrolled, in quarters. */
export const SCROLL_DEPTHS = [25, 50, 75, 100] as const;

/** A visitor scrolled past a quarter mark of a public page (each mark once per view). */
export const sitePageScrolledEvent = defineEvent(
  "site.page_scrolled",
  { strings: ["page"], numbers: ["depth"] },
  z
    .object({
      page: siteId,
      depth: z
        .number()
        .refine((depth) =>
          (SCROLL_DEPTHS as readonly number[]).includes(depth)
        ),
    })
    .strict(),
  {
    client: false,
    site: true,
    description:
      "A visitor scrolled past 25, 50, 75 or 100 % of a public page (once per mark and view)",
  }
);

/** What showed that a page view got the pitch. */
export const ENGAGEMENT_SIGNALS = [
  "scrolled",
  "video",
  "feature_map",
  "docs",
] as const;

/**
 * A page view showed interest, once per view, at its first signal: scrolled past half of
 * the page, played a video, used the feature map, or opened a docs page. The funnel's
 * interest step counts these.
 */
export const sitePageEngagedEvent = defineEvent(
  "site.page_engaged",
  { strings: ["page", "signal"], numbers: [] },
  z.object({ page: siteId, signal: z.enum(ENGAGEMENT_SIGNALS) }).strict(),
  {
    client: false,
    site: true,
    description:
      "A page view showed interest (scroll past half, video, feature map, docs), once per view",
  }
);

/**
 * A call to action was clicked: which one (`demo`, `github`, `copy_prompt`) and where on
 * the page (`hero`, `closing`, `header`). The funnel's intent step counts these.
 */
export const siteCtaClickedEvent = defineEvent(
  "site.cta_clicked",
  { strings: ["cta", "placement"], numbers: [] },
  z.object({ cta: siteId, placement: siteId }).strict(),
  {
    client: false,
    site: true,
    description:
      "A call to action was clicked: which one and where on the page",
  }
);

/** A video on a public page started playing (each video once per view). */
export const siteVideoPlayedEvent = defineEvent(
  "site.video_played",
  { strings: ["video"], numbers: [] },
  z.object({ video: siteId }).strict(),
  {
    client: false,
    site: true,
    description:
      "A video on a public page started playing (once per video and view)",
  }
);

/** A video on a public page played to its end. */
export const siteVideoCompletedEvent = defineEvent(
  "site.video_completed",
  { strings: ["video"], numbers: [] },
  z.object({ video: siteId }).strict(),
  {
    client: false,
    site: true,
    description: "A video on a public page played to the end",
  }
);

/** How the feature map was used. */
export const FEATURE_MAP_ACTIONS = ["select", "filter"] as const;

/** The landing page's feature map was used (once per action and view). */
export const siteFeatureMapUsedEvent = defineEvent(
  "site.feature_map_used",
  { strings: ["action"], numbers: [] },
  z.object({ action: z.enum(FEATURE_MAP_ACTIONS) }).strict(),
  {
    client: false,
    site: true,
    description:
      "The feature map was used: a group selected or the map filtered (once per action and view)",
  }
);

/**
 * A docs page was read: its section (the first path segment under /docs, `guides`,
 * `reference`; `home` for /docs itself), never the page's path.
 */
export const docsPageViewedEvent = defineEvent(
  "docs.page_viewed",
  { strings: ["section"], numbers: [] },
  z.object({ section: siteId }).strict(),
  {
    client: false,
    site: true,
    description:
      "A docs page was shown: its section only (guides, reference, …)",
  }
);
