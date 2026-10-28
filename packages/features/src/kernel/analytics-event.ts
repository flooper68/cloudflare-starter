/**
 * The shapes every feature uses to declare a product analytics event (a Segment `track`
 * call: an event name and its properties). Pure types, limits and one identity helper:
 * features declare events in their `domain/analytics-events.ts`, which may import only
 * the kernel. The rules (catalog, name and property checks, client batches) live in the
 * product-analytics feature (`packages/features/src/product-analytics`).
 */
import type { PayloadSchema } from "./job";

/** A property value: strings and numbers only, null for "not known". */
export type AnalyticsPropertyValue = string | number | null;

/** The properties of one event, by name. */
export type AnalyticsProperties = Readonly<
  Record<string, AnalyticsPropertyValue>
>;

/**
 * Where each property goes: string properties in `strings`, numeric ones in `numbers`,
 * in this order. The order is the storage layout (Analytics Engine blob and double slots),
 * so a property is only ever appended, never moved or reused for another meaning.
 */
export interface AnalyticsEventLayout<TName extends string = string> {
  readonly strings: readonly TName[];
  readonly numbers: readonly TName[];
}

/** One product event: its name, property layout, property schema and who may send it. */
export interface AnalyticsEventDefinition<
  TProps extends AnalyticsProperties = AnalyticsProperties,
> {
  /** `<feature>.<object>_<past-tense verb>` in lowercase snake case (`files.uploaded`). */
  readonly name: string;
  /** Names of `TProps` in slot order (checked by `defineEvent`'s signature). */
  readonly layout: AnalyticsEventLayout;
  readonly properties: PayloadSchema<TProps>;
  /** True when the browser may send it through `analytics.track` (UI events). */
  readonly client: boolean;
  /** What happened, for people reading the catalog and querying the data. */
  readonly description: string;
}

/**
 * Limits every event in the catalog fits, set by the strictest shipped adapter (Workers
 * Analytics Engine: 20 blobs of which 6 are fixed, 20 doubles, one index of at most 96
 * bytes, 250 data points per invocation).
 */
export const ANALYTICS_LIMITS = {
  /** String properties per event (20 blobs minus the 6 fixed ones). */
  strings: 14,
  /** Numeric properties per event (20 doubles). */
  numbers: 20,
  /** Characters of an event name (the index, at most 96 bytes; names are ASCII). */
  nameLength: 64,
  /** Bytes of one string property value; longer values are cut. */
  stringBytes: 256,
  /** Events and identify calls delivered per unit of work; more are dropped. */
  pointsPerInvocation: 250,
  /** Events in one client batch (`analytics.track`). */
  clientBatch: 20,
} as const;

/** `<feature>.<object>_<verb>`: lowercase snake-case segments joined by dots. */
export const ANALYTICS_EVENT_NAME = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

/** The reserved event name of an identify call (Segment `identify`). */
export const IDENTIFY_EVENT = "$identify";

/**
 * Declares a product event. Lives in the owning feature's `domain/analytics-events.ts`
 * and is registered in `packages/features/src/analytics-events.ts`.
 */
export function defineEvent<TProps extends AnalyticsProperties>(
  name: string,
  layout: {
    readonly strings: readonly NoInfer<keyof TProps & string>[];
    readonly numbers: readonly NoInfer<keyof TProps & string>[];
  },
  properties: PayloadSchema<TProps>,
  options: { readonly client: boolean; readonly description: string }
): AnalyticsEventDefinition<TProps> {
  return Object.freeze({
    name,
    layout: Object.freeze({
      strings: [...layout.strings],
      numbers: [...layout.numbers],
    }),
    properties,
    client: options.client,
    description: options.description,
  });
}
