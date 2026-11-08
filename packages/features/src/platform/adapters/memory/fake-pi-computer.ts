import {
  type PiComputation,
  type PiComputer,
  PiComputerError,
} from "../../ports/pi-computer";

const MAX_DIGITS = 100_000;

const C3_OVER_24 = 640_320n ** 3n / 24n;

/** P, Q, T of the Chudnovsky terms [a, b), by binary splitting (as pi_task.py does). */
function split(a: bigint, b: bigint): [bigint, bigint, bigint] {
  if (b - a === 1n) {
    const p = a === 0n ? 1n : (6n * a - 5n) * (2n * a - 1n) * (6n * a - 1n);
    const q = a === 0n ? 1n : a * a * a * C3_OVER_24;
    const t = p * (13_591_409n + 545_140_134n * a);
    return [p, q, a % 2n === 1n ? -t : t];
  }
  const m = (a + b) / 2n;
  const [p1, q1, t1] = split(a, m);
  const [p2, q2, t2] = split(m, b);
  return [p1 * p2, q1 * q2, q2 * t1 + p1 * t2];
}

/**
 * The integer square root of n: the root of n's top half (recursively) as the start, then
 * Newton's method, which needs only a step or two from there.
 */
function isqrt(n: bigint): bigint {
  if (n < 1n << 52n) {
    let x = BigInt(Math.floor(Math.sqrt(Number(n))));
    while (x * x > n) x -= 1n;
    while ((x + 1n) * (x + 1n) <= n) x += 1n;
    return x;
  }
  const k = BigInt(n.toString(16).length * 4) >> 2n;
  let x = (isqrt(n >> (2n * k)) + 1n) << k;
  for (;;) {
    const y = (x + n / x) >> 1n;
    if (y >= x) return x;
    x = y;
  }
}

/**
 * Pi with `digits` decimals ("3.14…"): the same Chudnovsky series and binary splitting
 * as the container's pi_task.py, in BigInt arithmetic, so 50,000 digits take well under
 * a second of a Worker's CPU (a plain arctan series would take tens of seconds).
 */
export function chudnovskyPi(digits: number): string {
  const guard = 10;
  const terms = BigInt(Math.floor(digits / 14) + 2);
  const [, q, t] = split(0n, terms);
  const one = 10n ** BigInt(digits + guard);
  const pi = (q * 426_880n * isqrt(10_005n * one * one)) / t;
  const text = (pi / 10n ** BigInt(guard)).toString();
  return `${text[0]}.${text.slice(1)}`;
}

/**
 * The fake pi container (CONTAINER_DEMO_RUNNER=fake): computes in the Worker, so local dev,
 * the E2E journeys and the API tests run the whole workflow without Docker or a Cloudflare
 * account. `delayMs` stands in for a container's start-up, so the timeline has something to
 * show; `fail` makes the next calls fail (tests).
 */
export function createFakePiComputer(
  options: {
    readonly delayMs?: number;
    readonly fail?: () => "unavailable" | "failed" | null;
    readonly sleep?: (ms: number) => Promise<void>;
  } = {}
): PiComputer {
  const sleep =
    options.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const failure = () => {
    const kind = options.fail?.();
    if (kind) throw new PiComputerError(kind, `fake pi computer: ${kind}`);
  };
  return {
    async warm() {
      if (options.delayMs) await sleep(options.delayMs);
      failure();
    },
    async compute(digits): Promise<PiComputation> {
      if (!Number.isInteger(digits) || digits < 1 || digits > MAX_DIGITS) {
        throw new PiComputerError(
          "failed",
          `digits must be between 1 and ${MAX_DIGITS}`
        );
      }
      failure();
      const started = Date.now();
      const pi = chudnovskyPi(digits);
      if (options.delayMs) await sleep(options.delayMs);
      return { pi, digits, elapsedMs: Date.now() - started };
    },
  };
}
