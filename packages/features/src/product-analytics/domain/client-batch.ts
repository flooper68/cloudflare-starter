import { z } from "zod";

import {
  ANALYTICS_LIMITS,
  type AnalyticsEventDefinition,
  type AnalyticsProperties,
} from "../../kernel";
import { InvalidAnalyticsEventError } from "./errors";
import type { AnalyticsEventCatalog } from "./event-catalog";

/** The input of `analytics.track`: up to 20 events the browser saw happen. */
export const clientBatchSchema = z.object({
  events: z
    .array(
      z.object({
        event: z.string().min(1).max(ANALYTICS_LIMITS.nameLength),
        properties: z
          .record(
            z.string().max(64),
            z.union([z.string().max(512), z.number(), z.null()])
          )
          .default({}),
      })
    )
    .min(1)
    .max(ANALYTICS_LIMITS.clientBatch)
    .describe(
      `Up to ${ANALYTICS_LIMITS.clientBatch} client events of the analytics catalog, oldest first.`
    ),
});

export type ClientBatch = z.infer<typeof clientBatchSchema>;

/** One validated client event, ready to track. */
export interface ClientEvent {
  readonly definition: AnalyticsEventDefinition;
  readonly properties: AnalyticsProperties;
}

/**
 * Checks each event of a batch against the catalog: it must be a `client: true` event and
 * its properties must pass the event's schema. One bad event refuses the whole batch, so
 * a broken client shows up as an error instead of a silent gap.
 */
export function parseClientBatch(
  catalog: AnalyticsEventCatalog,
  batch: ClientBatch
): ClientEvent[] {
  return batch.events.map((sent, i) => {
    const definition = catalog.get(sent.event);
    if (!definition?.client) {
      throw new InvalidAnalyticsEventError(
        `events[${i}]: "${sent.event.slice(0, 64)}" is not a client event of the analytics catalog`
      );
    }
    const parsed = definition.properties.safeParse(sent.properties);
    if (!parsed.success) {
      throw new InvalidAnalyticsEventError(
        `events[${i}]: invalid properties for ${definition.name}`
      );
    }
    return { definition, properties: parsed.data };
  });
}
