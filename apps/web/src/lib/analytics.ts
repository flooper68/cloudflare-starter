/**
 * Client product events (docs/guides/how-to-setup-product-analytics.md): the SPA reports
 * `client: true` events of the catalog with `trackClientEvent(<event name>, properties)` (the
 * name a string literal, so test/architecture/product-analytics.test.ts can find it).
 * Events are batched (up to 20, or after 2 s, or when the page is hidden) and sent with
 * `analytics.track`; the server attributes them to the signed-in user and their current
 * workspace. Best effort: a failed send is dropped, never retried or shown.
 */
import type { inferRouterInputs } from "@trpc/server";

import { trpc } from "@/lib/trpc/client";
import type { AppRouter } from "@/server/trpc/router";

type ClientEvent =
  inferRouterInputs<AppRouter>["analytics"]["track"]["events"][number];

/** ANALYTICS_LIMITS.clientBatch: the most `analytics.track` accepts at once. */
const MAX_BATCH = 20;
const FLUSH_AFTER_MS = 2000;

let queue: ClientEvent[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
let listening = false;

function flush(): void {
  if (timer) clearTimeout(timer);
  timer = undefined;
  while (queue.length > 0) {
    const events = queue.slice(0, MAX_BATCH);
    queue = queue.slice(MAX_BATCH);
    trpc.analytics.track.mutate({ events }).catch(() => {
      // Telemetry: losing a batch is fine, bothering the user is not.
    });
  }
}

/** Queues one client event; sent with the next batch. */
export function trackClientEvent(
  event: ClientEvent["event"],
  properties: ClientEvent["properties"] = {}
): void {
  if (typeof window === "undefined") return;
  if (!listening) {
    listening = true;
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
  }
  queue.push({ event, properties });
  if (queue.length >= MAX_BATCH) flush();
  else timer ??= setTimeout(flush, FLUSH_AFTER_MS);
}
