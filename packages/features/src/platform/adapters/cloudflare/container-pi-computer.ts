import { z } from "zod";

import {
  type PiComputation,
  type PiComputer,
  PiComputerError,
} from "../../ports/pi-computer";

const MAX_DIGITS = 100_000;

/** The pi container's answer (apps/container/server.py). */
const answerSchema = z.union([
  z.object({
    ok: z.literal(true),
    digits: z.number().int().positive(),
    pi: z.string().regex(/^3\.\d+$/),
    elapsedMs: z.number().nonnegative(),
  }),
  z.object({ ok: z.literal(false), error: z.string() }),
]);

/**
 * The pi container (apps/container) through a service binding to its Worker
 * (PI_CONTAINER_SERVICE, CONTAINER_DEMO_RUNNER=container). `GET /pi?digits=&instance=`;
 * warming asks for one digit, which starts the container and waits for its port. A 5xx,
 * a network error or an unreadable answer is `unavailable` (worth retrying); a 4xx or an
 * answer of `ok: false` is `failed`.
 */
export function createContainerPiComputer(config: {
  readonly service: Fetcher;
}): PiComputer {
  async function call(
    digits: number,
    instance: number
  ): Promise<PiComputation> {
    let response: Response;
    try {
      response = await config.service.fetch(
        `https://pi-container/pi?digits=${digits}&instance=${instance}`
      );
    } catch (error) {
      throw new PiComputerError(
        "unavailable",
        `pi container unreachable: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    const parsed = answerSchema.safeParse(body);
    if (response.status >= 500 || !parsed.success) {
      throw new PiComputerError(
        "unavailable",
        `pi container answered ${response.status}`
      );
    }
    if (!parsed.data.ok || !response.ok) {
      throw new PiComputerError(
        "failed",
        parsed.data.ok
          ? `pi container answered ${response.status}`
          : parsed.data.error
      );
    }
    if (parsed.data.digits !== digits) {
      throw new PiComputerError("failed", "pi container returned other digits");
    }
    return {
      pi: parsed.data.pi,
      digits: parsed.data.digits,
      elapsedMs: parsed.data.elapsedMs,
    };
  }

  return {
    async warm(instance) {
      await call(1, instance);
    },
    compute(digits, instance) {
      if (!Number.isInteger(digits) || digits < 1 || digits > MAX_DIGITS) {
        return Promise.reject(
          new PiComputerError(
            "failed",
            `digits must be between 1 and ${MAX_DIGITS}`
          )
        );
      }
      return call(digits, instance);
    },
  };
}
