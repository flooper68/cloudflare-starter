import { describe, expect, it } from "vitest";

import { PiComputerError } from "../../ports/pi-computer";
import { describePiComputerContract } from "../../ports/pi-computer.contract";
import { chudnovskyPi } from "../memory/fake-pi-computer";
import { createContainerPiComputer } from "./container-pi-computer";

/**
 * A stand-in for the pi container Worker (apps/container/src/index.ts and server.py): the
 * same routes, statuses and JSON, so the adapter is checked against the container's HTTP
 * contract without Docker.
 */
function containerWorker(
  requests: string[] = [],
  override?: (url: URL) => Response | null
): Fetcher {
  return {
    async fetch(input: RequestInfo | URL) {
      const url = new URL(String(input instanceof Request ? input.url : input));
      requests.push(`${url.pathname}${url.search}`);
      const custom = override?.(url);
      if (custom) return custom;
      const digits = Number(url.searchParams.get("digits"));
      if (!Number.isInteger(digits) || digits < 1 || digits > 100_000) {
        return Response.json(
          { ok: false, error: "digits must be between 1 and 100000" },
          { status: 400 }
        );
      }
      return Response.json({
        ok: true,
        digits,
        pi: chudnovskyPi(digits),
        elapsedMs: 12.5,
        containerPid: 1,
      });
    },
    connect() {
      throw new Error("not used");
    },
  } as unknown as Fetcher;
}

describePiComputerContract("createContainerPiComputer", () => ({
  computer: createContainerPiComputer({ service: containerWorker() }),
}));

describe("createContainerPiComputer", () => {
  it("asks the chosen instance; warming computes one digit", async () => {
    const requests: string[] = [];
    const computer = createContainerPiComputer({
      service: containerWorker(requests),
    });
    await computer.warm(1);
    await computer.compute(20, 1);
    expect(requests).toEqual([
      "/pi?digits=1&instance=1",
      "/pi?digits=20&instance=1",
    ]);
  });

  it("is unavailable when the container answers 5xx or the network fails", async () => {
    const down = createContainerPiComputer({
      service: containerWorker([], () =>
        Response.json({ ok: false, error: "starting" }, { status: 503 })
      ),
    });
    expect(await down.warm(0).catch((e) => e.failure)).toBe("unavailable");

    const unreachable = createContainerPiComputer({
      service: {
        fetch: () => Promise.reject(new Error("connection refused")),
      } as unknown as Fetcher,
    });
    const error = await unreachable.compute(10, 0).catch((e) => e);
    expect(error).toBeInstanceOf(PiComputerError);
    expect(error.failure).toBe("unavailable");
  });

  it("fails when the container returns other digits than asked", async () => {
    const computer = createContainerPiComputer({
      service: containerWorker([], () =>
        Response.json({ ok: true, digits: 5, pi: "3.14159", elapsedMs: 1 })
      ),
    });
    expect(await computer.compute(10, 0).catch((e) => e.failure)).toBe(
      "failed"
    );
  });
});
