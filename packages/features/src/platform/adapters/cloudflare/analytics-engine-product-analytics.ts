import { createHmac } from "node:crypto";

import {
  ANALYTICS_LIMITS,
  type AnalyticsEventLayout,
  type AnalyticsPropertyValue,
  IDENTIFY_EVENT,
} from "../../../kernel";
import {
  createPointBudget,
  undeliverableReason,
} from "../../analytics-delivery";
import type {
  AnalyticsContext,
  ProductAnalytics,
  TrackedEvent,
} from "../../ports";

/**
 * The blobs every data point starts with, in this order; string properties follow from
 * blob7 in the catalog's order, numeric properties fill double1.. in order, and index1
 * is the event name (the sampling key). Querying: docs/guides/how-to-setup-product-analytics.md.
 */
export const ANALYTICS_ENGINE_FIXED_BLOBS = [
  "event",
  "user",
  "workspace",
  "environment",
  "release",
  "source",
] as const;

/** Hex characters kept of the HMAC-SHA256: 128 bits, enough to never collide. */
const PSEUDONYM_LENGTH = 32;

/**
 * The pseudonymous key of a user or workspace id: HMAC-SHA256 under ANALYTICS_ID_SECRET,
 * first 32 hex characters; "" when there is none. The same id always gives the same key,
 * and without the secret the key cannot be turned back into the id. Rotating the secret
 * starts every key afresh.
 */
export function pseudonymousId(secret: string, id: string | null): string {
  if (!id) return "";
  return createHmac("sha256", secret)
    .update(id)
    .digest("hex")
    .slice(0, PSEUDONYM_LENGTH);
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Cuts a string to at most `maxBytes` of UTF-8 without splitting a character. */
function truncateUtf8(value: string, maxBytes: number): string {
  const bytes = encoder.encode(value);
  if (bytes.length <= maxBytes) return value;
  let cut = maxBytes;
  // Step back over continuation bytes (10xxxxxx) to the start of a character.
  while (cut > 0 && ((bytes[cut] ?? 0) & 0xc0) === 0x80) cut--;
  return decoder.decode(bytes.subarray(0, cut));
}

function blob(value: AnalyticsPropertyValue | undefined): string {
  if (value === null || value === undefined) return "";
  return truncateUtf8(String(value), ANALYTICS_LIMITS.stringBytes);
}

function double(value: AnalyticsPropertyValue | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** The Analytics Engine data point of one call (layout already checked). */
export function toAnalyticsEngineDataPoint(
  call: TrackedEvent,
  context: AnalyticsContext,
  idSecret: string
): AnalyticsEngineDataPoint {
  return {
    indexes: [call.event],
    blobs: [
      call.event,
      pseudonymousId(idSecret, context.userId),
      pseudonymousId(idSecret, context.workspaceId),
      blob(context.environment),
      blob(context.release),
      blob(context.source),
      ...call.layout.strings.map((name) => blob(call.properties[name])),
    ],
    doubles: call.layout.numbers.map((name) => double(call.properties[name])),
  };
}

/** A data point read back into names: for tests, evidence and query authors. */
export interface DecodedAnalyticsDataPoint {
  readonly event: string;
  readonly user: string | null;
  readonly workspace: string | null;
  readonly environment: string;
  readonly release: string;
  readonly source: string;
  readonly properties: Readonly<Record<string, AnalyticsPropertyValue>>;
}

/**
 * Decodes a data point written by this adapter. With the event's layout the properties
 * get their names; without it they are `blob7`.., `double1`.., the column names in SQL.
 */
export function decodeAnalyticsEngineDataPoint(
  point: AnalyticsEngineDataPoint,
  layout?: AnalyticsEventLayout
): DecodedAnalyticsDataPoint {
  const blobs = (point.blobs ?? []).map((value) =>
    typeof value === "string" ? value : value === null ? "" : "<binary>"
  );
  const doubles = point.doubles ?? [];
  const fixed = ANALYTICS_ENGINE_FIXED_BLOBS.length;
  const properties: Record<string, AnalyticsPropertyValue> = {};
  blobs.slice(fixed).forEach((value, i) => {
    properties[layout?.strings[i] ?? `blob${fixed + i + 1}`] = value || null;
  });
  doubles.forEach((value, i) => {
    properties[layout?.numbers[i] ?? `double${i + 1}`] = value;
  });
  return {
    event: blobs[0] ?? "",
    user: blobs[1] || null,
    workspace: blobs[2] || null,
    environment: blobs[3] ?? "",
    release: blobs[4] ?? "",
    source: blobs[5] ?? "",
    properties,
  };
}

export interface AnalyticsEngineProductAnalyticsOptions {
  /** The ANALYTICS_EVENTS dataset binding (`analytics_engine_datasets`). */
  readonly dataset: AnalyticsEngineDataset;
  /** ANALYTICS_ID_SECRET: the HMAC key of the pseudonymous user and workspace ids. */
  readonly idSecret: string;
  /** Told about each dropped call (logged as a warning by the composition root). */
  readonly onDrop?: (event: string, reason: string) => void;
}

/**
 * ProductAnalytics on Workers Analytics Engine: one data point per call, written without
 * waiting (the runtime sends it after the response). User and workspace ids leave the app
 * only as pseudonyms. Build one per unit of work: it stops at 250 points, Analytics
 * Engine's limit per invocation.
 */
export function createAnalyticsEngineProductAnalytics(
  options: AnalyticsEngineProductAnalyticsOptions
): ProductAnalytics {
  const budget = createPointBudget();

  function write(call: TrackedEvent, context: AnalyticsContext) {
    try {
      const reason =
        undeliverableReason(call.event, call.layout) ??
        (budget.take() ? null : "per-invocation budget used up");
      if (reason) {
        options.onDrop?.(call.event, reason);
        return;
      }
      options.dataset.writeDataPoint(
        toAnalyticsEngineDataPoint(call, context, options.idSecret)
      );
    } catch (error) {
      options.onDrop?.(
        call.event,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  return {
    track(event, context) {
      write(event, context);
    },
    identify(context, traits) {
      write(
        {
          event: IDENTIFY_EVENT,
          properties: traits.traits,
          layout: traits.layout,
        },
        context
      );
    },
  };
}
