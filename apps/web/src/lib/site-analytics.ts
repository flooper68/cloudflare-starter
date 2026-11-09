/**
 * The public pages' analytics (docs/reference/product-analytics.md#site-events): `site:
 * true` events of the catalog, sent anonymously with navigator.sendBeacon to
 * /api/site-events, named with string literals (`trackSiteEvent("site.cta_clicked", …)`,
 * so test/architecture/product-analytics.test.ts can find them). No cookie, no storage, no
 * visitor id: each page view stands alone. Only on pages that carry the
 * `<meta name="app-site-events">` tag (ANALYTICS=analytics-engine, SiteEvents.astro), and
 * never from an automated browser (navigator.webdriver: the QA and E2E suites). Events
 * are batched (up to 10, after 1 s, at once on a click that leaves the page, or when the
 * page is hidden). Best effort: a lost batch is never retried.
 */

/** ANALYTICS_LIMITS.siteBatch: the most /api/site-events accepts at once. */
const MAX_BATCH = 10;
const FLUSH_AFTER_MS = 1000;

type Properties = Readonly<Record<string, string | number | null>>;

let queue: { event: string; properties: Properties }[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
let listening = false;
const sentOnce = new Set<string>();

/** The endpoint, or null when this page does not collect (or a robot drives it). */
function endpoint(): string | null {
  if (typeof document === "undefined" || navigator.webdriver) return null;
  return (
    document
      .querySelector<HTMLMetaElement>('meta[name="app-site-events"]')
      ?.getAttribute("content") ?? null
  );
}

/** Sends what is queued now. */
export function flushSiteEvents(): void {
  if (timer) clearTimeout(timer);
  timer = undefined;
  const url = endpoint();
  while (url && queue.length > 0) {
    const body = JSON.stringify({ events: queue.slice(0, MAX_BATCH) });
    queue = queue.slice(MAX_BATCH);
    if (!navigator.sendBeacon?.(url, body)) {
      fetch(url, { method: "POST", body, keepalive: true }).catch(() => {
        // Analytics: losing a batch is fine, bothering the visitor is not.
      });
    }
  }
  queue = [];
}

/**
 * Queues one site event. `once` names a key: the event is sent at most once per page
 * view for it (a scroll mark, a video started).
 */
export function trackSiteEvent(
  event: string,
  properties: Properties = {},
  options: { readonly once?: string; readonly now?: boolean } = {}
): void {
  if (!endpoint()) return;
  if (options.once) {
    if (sentOnce.has(options.once)) return;
    sentOnce.add(options.once);
  }
  if (!listening) {
    listening = true;
    window.addEventListener("pagehide", flushSiteEvents);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushSiteEvents();
    });
  }
  queue.push({ event, properties });
  if (options.now || queue.length >= MAX_BATCH) flushSiteEvents();
  else timer ??= setTimeout(flushSiteEvents, FLUSH_AFTER_MS);
}

/** The page kind of this page (the meta tag's `data-page`), `other` without one. */
export function sitePage(): string {
  return (
    document.querySelector<HTMLMetaElement>('meta[name="app-site-events"]')
      ?.dataset.page || "other"
  );
}

/** The page kind of a public path: `home`, `docs`, `changelog`, `sign_up`, `not_found`. */
export function sitePageOf(pathname: string): string {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return "home";
  if (path === "/404" || path === "/404.html") return "not_found";
  if (path === "/docs/changelog") return "changelog";
  if (path === "/docs" || path.startsWith("/docs/")) return "docs";
  return id(path.split("/")[1]?.toLowerCase().replace(/-/g, "_")) ?? "other";
}

/** The first sign of interest on this page view (site.page_engaged), once. */
export function markEngaged(
  signal: "scrolled" | "video" | "feature_map" | "docs"
): void {
  trackSiteEvent(
    "site.page_engaged",
    { page: sitePage(), signal },
    { once: "engaged" }
  );
}

/** A lowercase id from page data (`data-track-cta`), or null when it is not one. */
function id(value: string | undefined): string | null {
  return value && /^[a-z0-9][a-z0-9_-]{0,47}$/.test(value) ? value : null;
}

/** Where the visit came from: the referrer's host when it is another site. */
export function visitSource(
  referrer: string,
  location: { readonly host: string; readonly search: string }
): { entry: "yes" | "no"; referrer_host: string; utm_source: string } {
  let host = "";
  try {
    host = referrer ? new URL(referrer).host.toLowerCase() : "";
  } catch {
    host = "";
  }
  if (host === location.host.toLowerCase())
    return { entry: "no", referrer_host: "", utm_source: "" };
  const source = (new URLSearchParams(location.search).get("utm_source") ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 64);
  return {
    entry: "yes",
    referrer_host: host.replace(/[^a-z0-9.-]/g, "").slice(0, 100),
    utm_source: source,
  };
}

/** The docs section of a path (`/docs/guides/x/` → `guides`, `/docs/` → `home`). */
export function docsSection(pathname: string): string {
  const segment = pathname.split("/")[2] ?? "";
  return id(segment.toLowerCase()) ?? "home";
}

/**
 * Starts the public page's analytics: the page view (with where the visit came from),
 * the docs section, scroll marks and calls to action (`data-track-cta` with
 * `data-track-placement`). Videos are tracked by the walkthrough player
 * (components/media/video-player.ts), the feature map by its element. Called once by
 * SiteEvents.astro's script.
 */
export function startSiteAnalytics(): void {
  if (!endpoint()) return;
  const page = sitePage();
  trackSiteEvent("site.page_viewed", {
    page,
    ...visitSource(document.referrer, window.location),
  });
  if (page === "docs") {
    trackSiteEvent("docs.page_viewed", {
      section: docsSection(window.location.pathname),
    });
    markEngaged("docs");
  }

  const onScroll = () => {
    const doc = document.documentElement;
    const scrollable = doc.scrollHeight - window.innerHeight;
    const reached =
      scrollable <= 0 ? 100 : ((window.scrollY + 1) / scrollable) * 100;
    for (const depth of [25, 50, 75, 100]) {
      if (reached < depth) break;
      trackSiteEvent(
        "site.page_scrolled",
        { page, depth },
        { once: `scroll:${depth}` }
      );
      if (depth >= 50) markEngaged("scrolled");
    }
  };
  window.addEventListener("scroll", onScroll, { passive: true });

  document.addEventListener("click", (event) => {
    const target = (event.target as Element | null)?.closest<HTMLElement>(
      "[data-track-cta]"
    );
    const cta = id(target?.dataset.trackCta);
    if (!target || !cta) return;
    trackSiteEvent(
      "site.cta_clicked",
      { cta, placement: id(target.dataset.trackPlacement) ?? "page" },
      // A link leaves the page: send before it does.
      { now: target.tagName === "A" }
    );
  });
}

/** Forgets the page view's state (tests). */
export function resetSiteAnalytics(): void {
  queue = [];
  sentOnce.clear();
  if (timer) clearTimeout(timer);
  timer = undefined;
}
