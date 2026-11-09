import { describe, expect, it } from "vitest";
import { PiComputerError } from "../../ports/pi-computer";
import { describePiComputerContract } from "../../ports/pi-computer.contract";
import { chudnovskyPi, createFakePiComputer } from "./fake-pi-computer";

describePiComputerContract("createFakePiComputer", () => ({
  computer: createFakePiComputer(),
}));

describe("createFakePiComputer", () => {
  it("waits delayMs on warm and compute, like a container starting", async () => {
    const waits: number[] = [];
    const computer = createFakePiComputer({
      delayMs: 250,
      sleep: async (ms) => {
        waits.push(ms);
      },
    });
    await computer.warm(0);
    await computer.compute(10, 0);
    expect(waits).toEqual([250, 250]);
  });

  it("fails with the failure the test asks for", async () => {
    const computer = createFakePiComputer({ fail: () => "unavailable" });
    const error = await computer.warm(0).catch((e) => e);
    expect(error).toBeInstanceOf(PiComputerError);
    expect(error.failure).toBe("unavailable");
  });

  it("matches the container's digits at 10,000 decimals", () => {
    // The last ten decimals of pi to 10,000 places (pi_task.py prints the same).
    expect(chudnovskyPi(10_000).slice(-10)).toBe("5256375678");
  });

  it("computes the largest preset fast enough for a Workflow step on its CPU", () => {
    const started = performance.now();
    expect(chudnovskyPi(50_000).slice(-10)).toBe("6574236041");
    // About 50 ms in V8 (workerd's engine); a step may use 30 s of CPU.
    expect(performance.now() - started).toBeLessThan(5000);
  });
});
