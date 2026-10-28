import { IDENTIFY_EVENT } from "../../../kernel";
import {
  createPointBudget,
  undeliverableReason,
} from "../../analytics-delivery";
import type {
  AnalyticsContext,
  ProductAnalytics,
  TrackedEvent,
} from "../../ports";

/** One call the memory adapter recorded: identify calls have event `$identify`. */
export interface RecordedAnalytics extends TrackedEvent {
  readonly kind: "track" | "identify";
  readonly context: AnalyticsContext;
}

export interface MemoryProductAnalytics extends ProductAnalytics {
  /** Every delivered call, oldest first, with the raw (not pseudonymous) context. */
  readonly recorded: readonly RecordedAnalytics[];
  /** Calls dropped (over the limits or the per-invocation budget), with the reason. */
  readonly dropped: readonly {
    readonly event: string;
    readonly reason: string;
  }[];
}

/**
 * ProductAnalytics in memory, for tests: records what the app tracked and drops what a
 * real adapter would drop (names and layouts over the limits, more than 250 calls).
 */
export function createMemoryProductAnalytics(): MemoryProductAnalytics {
  const recorded: RecordedAnalytics[] = [];
  const dropped: { event: string; reason: string }[] = [];
  const budget = createPointBudget();

  function deliver(
    kind: "track" | "identify",
    call: TrackedEvent,
    context: AnalyticsContext
  ) {
    const reason =
      undeliverableReason(call.event, call.layout) ??
      (budget.take() ? null : "per-invocation budget used up");
    if (reason) {
      dropped.push({ event: call.event, reason });
      return;
    }
    recorded.push({ kind, ...call, context: { ...context } });
  }

  return {
    recorded,
    dropped,
    track(event, context) {
      deliver("track", event, context);
    },
    identify(context, traits) {
      deliver(
        "identify",
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
