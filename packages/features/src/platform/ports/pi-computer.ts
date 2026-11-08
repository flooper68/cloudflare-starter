/** Digits of pi as the computer returned them. */
export interface PiComputation {
  /** "3.14159…" with `digits` decimals. */
  readonly pi: string;
  readonly digits: number;
  /** The computation's own time, in milliseconds (the container's child process). */
  readonly elapsedMs: number;
}

/** Why a computation failed: the container could not be reached or started, or it refused or failed the task. */
export type PiComputerFailure = "unavailable" | "failed";

export class PiComputerError extends Error {
  readonly failure: PiComputerFailure;

  constructor(failure: PiComputerFailure, message: string) {
    super(message);
    this.name = "PiComputerError";
    this.failure = failure;
  }
}

/**
 * Port: the container task of the container workflow demo, digits of pi. The Cloudflare
 * adapter calls the pi container Worker (apps/container) through a service binding; the
 * fake computes in the Worker for local dev and tests (CONTAINER_DEMO_RUNNER).
 * `instance` picks one of the container instances (0 or 1), so the instance that warmed
 * up is the one that computes. Implementations pass `describePiComputerContract`
 * (pi-computer.contract.ts) and throw PiComputerError on failure.
 */
export interface PiComputer {
  /** Starts (or wakes) the instance and resolves once it answers. */
  warm(instance: number): Promise<void>;
  /** Pi with `digits` decimals (1..100000). */
  compute(digits: number, instance: number): Promise<PiComputation>;
}
