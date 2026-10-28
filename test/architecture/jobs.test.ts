/**
 * Background jobs and cron (docs/guides/how-to-add-background-jobs.md), in every environment
 * of apps/web/wrangler.jsonc:
 * - every queue consumer has a dead-letter queue, which nothing consumes and which
 *   `setup:cloudflare` creates with the maximum message retention (14 days);
 * - every consumer's max_retries equals JOB_MAX_RETRIES, which the consumer uses to find
 *   the final attempt it reports;
 * - `triggers.crons` lists exactly the schedules of the cron catalog, and every cron entry
 *   name appears in a test.
 */
import { parse } from "jsonc-parser";
import { describe, expect, it } from "vitest";

import {
  cronCatalog,
  cronSchedules,
  JOB_MAX_RETRIES,
} from "../../packages/features/src";

import {
  DLQ_MESSAGE_RETENTION_SECONDS,
  type QueueConsumerConfig,
  queuePlan,
} from "../../scripts/queue-plan";
import { filesUnder, read } from "./repo";

type Block = {
  queues?: { consumers?: (QueueConsumerConfig & Record<string, unknown>)[] };
  triggers?: { crons?: string[] };
};
const config = parse(read("apps/web/wrangler.jsonc")) as Block & {
  env?: Record<string, Block>;
};
const environments: [string, Block][] = [
  ["develop (top level)", config],
  ...Object.entries(config.env ?? {}),
];

describe("job queues", () => {
  it("covers every environment", () => {
    expect(environments.map(([name]) => name)).toEqual([
      "develop (top level)",
      "staging",
      "production",
    ]);
  });

  it.each(environments)(
    "%s: every consumer has a dead-letter queue that nothing consumes",
    (_, block) => {
      const consumers = block.queues?.consumers ?? [];
      expect(consumers.length).toBeGreaterThan(0);
      const consumed = new Set(consumers.map((c) => c.queue));
      for (const consumer of consumers) {
        expect(consumer.dead_letter_queue, consumer.queue).toMatch(/\S/);
        expect(consumer.dead_letter_queue).not.toBe(consumer.queue);
        expect(
          consumed.has(String(consumer.dead_letter_queue)),
          "a dead-letter queue has no consumer: failed jobs wait there to be inspected"
        ).toBe(false);
      }
    }
  );

  it.each(environments)(
    "%s: max_retries equals JOB_MAX_RETRIES",
    (_, block) => {
      for (const consumer of block.queues?.consumers ?? []) {
        expect(consumer.max_retries, consumer.queue).toBe(JOB_MAX_RETRIES);
      }
    }
  );

  it.each(environments)(
    "%s: setup:cloudflare creates each dead-letter queue with 14 days of retention",
    (_, block) => {
      const deadLetter = queuePlan(block).filter(
        (queue) => queue.role === "dead-letter"
      );
      expect(deadLetter.map((queue) => queue.name)).toEqual(
        (block.queues?.consumers ?? []).map((c) => c.dead_letter_queue)
      );
      for (const queue of deadLetter) {
        expect(queue.messageRetentionSeconds).toBe(
          DLQ_MESSAGE_RETENTION_SECONDS
        );
      }
    }
  );

  it("keeps dead-letter messages for the Queues maximum, 14 days", () => {
    expect(DLQ_MESSAGE_RETENTION_SECONDS).toBe(14 * 24 * 60 * 60);
  });
});

describe("cron", () => {
  it("has catalog entries", () => {
    expect(cronCatalog.length).toBeGreaterThan(0);
  });

  it.each(environments)(
    "%s: triggers.crons are exactly the cron catalog's schedules",
    (_, block) => {
      expect([...(block.triggers?.crons ?? [])].sort()).toEqual(
        cronSchedules(cronCatalog)
      );
    }
  );

  const tests = [
    ...filesUnder("packages/features/src", /\.test\.ts$/),
    ...filesUnder("apps/web", /\.test\.ts$/),
  ].map(read);

  it.each(cronCatalog.map((entry) => entry.name))(
    "cron entry %s is named in a test",
    (name) => {
      expect(
        tests.some((source) => source.includes(`"${name}"`)),
        "test the entry (apps/web/src/server/cron.test.ts) by its name"
      ).toBe(true);
    }
  );
});
