/**
 * The JobQueue contract: every adapter's `*.contract.test.ts` (or
 * `.contract.integration.test.ts`) runs this suite against it. Test support only (not
 * exported from the barrel, not bundled).
 */
import { afterEach, describe, expect, it } from "vitest";

import type { JobEnvelope } from "../../kernel";
import type { JobQueue } from "./job-queue";

/** One send as the adapter handed it on: the envelope and the delay it asked for. */
export interface ObservedSend {
  readonly envelope: unknown;
  readonly delaySeconds: number | undefined;
}

export interface JobQueueHarness {
  readonly queue: JobQueue;
  /** What reached the underlying queue, in order. */
  readonly sent: () => readonly ObservedSend[];
  readonly dispose?: () => void;
}

export function contractEnvelope(
  overrides: Partial<JobEnvelope> = {}
): JobEnvelope {
  return {
    specversion: "1.0",
    id: "6f1c2d3e-0000-4000-8000-000000000001",
    source: "/local/http",
    type: "contract.test",
    time: "2026-10-28T12:00:00.000Z",
    datacontenttype: "application/json",
    data: { name: "Nicole" },
    traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    userid: "user-1",
    ...overrides,
  };
}

export function describeJobQueueContract(
  name: string,
  makeHarness: () => JobQueueHarness
): void {
  describe(`${name} satisfies the JobQueue contract`, () => {
    const made: JobQueueHarness[] = [];
    const harness = () => {
      const created = makeHarness();
      made.push(created);
      return created;
    };
    afterEach(() => {
      for (const created of made.splice(0)) created.dispose?.();
    });

    it("sends the envelope unchanged, without a delay unless asked", async () => {
      const { queue, sent } = harness();
      await queue.send(contractEnvelope());
      expect(sent()).toEqual([
        { envelope: contractEnvelope(), delaySeconds: undefined },
      ]);
    });

    it("passes a delay through", async () => {
      const { queue, sent } = harness();
      await queue.send(contractEnvelope({ id: "a" }), { delaySeconds: 0 });
      await queue.send(contractEnvelope({ id: "b" }), { delaySeconds: 86_400 });
      expect(sent().map((send) => send.delaySeconds)).toEqual([0, 86_400]);
    });

    it.each([-1, 1.5, 86_401, Number.NaN])(
      "rejects delaySeconds %s before sending",
      async (delaySeconds) => {
        const { queue, sent } = harness();
        await expect(
          queue.send(contractEnvelope(), { delaySeconds })
        ).rejects.toBeInstanceOf(RangeError);
        expect(sent()).toEqual([]);
      }
    );
  });
}
