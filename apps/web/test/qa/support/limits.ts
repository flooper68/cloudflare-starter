/**
 * Keeps the whole run under the app's per-IP rate limits, across Playwright workers.
 * Production is shared and every journey runs from one IP, so each request to
 * /api/auth/* first takes a slot of every policy that counts it (auth.ip, plus the
 * endpoint's own: sign-up 5 a minute, sign-in 10, password reset 3, …), read from the
 * app's own catalog (packages/features/src/abuse/domain/policies.ts). Waiting for a slot
 * is waiting on the limit, not a fixed sleep. Each policy keeps to 80% of its limit, and
 * each is modelled the way its enforcer counts:
 *
 * - `better-auth`: Better Auth's limiter resets a counter only once a whole window has
 *   passed since the last allowed request (dist/api/rate-limiter). So a burst of up to
 *   the limit, then a full window of quiet before the next one.
 * - `edge` (Workers Rate Limiting): at most the limit within any window.
 *
 * Better Auth's counters are in D1 and outlive the run: start a run at least a minute
 * after the last one ended. The run's counters live in a file under the OS temp
 * directory; a lock directory serializes the workers.
 */
import {
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  RATE_LIMIT_POLICIES,
  type RateLimitPolicyId,
} from "../../../../../packages/features/src/abuse/domain/policies";

const MARGIN = 0.8;

function stateDir(): string {
  const dir = join(
    tmpdir(),
    "cloudflare-starter-qa",
    process.env.QA_RUN_ID ?? "no-run"
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Better Auth endpoints behind the human check (HUMAN_CHECKED_PATHS in server/auth.ts). */
const HUMAN_CHECKED = [
  "/sign-up/email",
  "/sign-in/email",
  "/request-password-reset",
];

/** The policies a request to `/api/auth<path>` counts against. */
export function authPolicies(path: string): RateLimitPolicyId[] {
  const policies: RateLimitPolicyId[] = ["auth.ip"];
  // The human-checked endpoints a QA run reaches through the QA bypass count against
  // `qa.bypass` too, with the outbox reads (inbox.ts) and the cleanup.
  if (HUMAN_CHECKED.includes(path)) policies.push("qa.bypass");
  for (const [id, policy] of Object.entries(RATE_LIMIT_POLICIES)) {
    const pattern = (policy as { authPath?: string }).authPath;
    if (!pattern) continue;
    const hit = pattern.endsWith("/*")
      ? path.startsWith(pattern.slice(0, -1))
      : path === pattern;
    if (hit) policies.push(id as RateLimitPolicyId);
  }
  return policies;
}

/** Allowed requests per policy so far: their times, oldest first. */
type Used = Record<string, number[]>;

/** How long `id` must wait before one more request (0: it may go now). */
function waitFor(id: RateLimitPolicyId, times: readonly number[], now: number) {
  const policy = RATE_LIMIT_POLICIES[id];
  const slots = Math.max(1, Math.floor(policy.limit * MARGIN));
  const windowMs = policy.periodSeconds * 1000;
  if (policy.enforcer === "better-auth") {
    // The current burst: the requests since the last gap of a whole window.
    let start = times.length;
    while (start > 0) {
      const earlier = times[start - 2];
      const at = times[start - 1] as number;
      start -= 1;
      if (earlier === undefined || at - earlier >= windowMs) break;
    }
    const last = times.at(-1);
    if (last === undefined || now - last >= windowMs) return 0;
    return times.length - start < slots ? 0 : last + windowMs - now;
  }
  const live = times.filter((at) => now - at < windowMs);
  return live.length < slots ? 0 : (live[0] as number) + windowMs - now;
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function locked<T>(fn: () => T | Promise<T>, name = "lock"): Promise<T> {
  const lock = join(stateDir(), name);
  for (;;) {
    try {
      mkdirSync(lock);
      break;
    } catch {
      // A lock left by a worker that died holding it is broken after three minutes.
      try {
        if (Date.now() - statSync(lock).mtimeMs > 180_000) {
          rmSync(lock, { recursive: true, force: true });
        }
      } catch {}
      await pause(20);
    }
  }
  try {
    return await fn();
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}

/** Takes one slot of each policy at once, waiting while any of them is full. */
export async function takeSlots(
  policies: readonly RateLimitPolicyId[]
): Promise<void> {
  const file = join(stateDir(), "slots.json");
  for (;;) {
    const wait = await locked(() => {
      let used: Used = {};
      try {
        used = JSON.parse(readFileSync(file, "utf8"));
      } catch {
        used = {};
      }
      const now = Date.now();
      const longest = Math.max(
        0,
        ...policies.map((id) => waitFor(id, used[id] ?? [], now))
      );
      if (longest === 0) {
        for (const id of policies) {
          // A burst can span up to `limit` windows; the edge model reads one.
          const policy = RATE_LIMIT_POLICIES[id];
          const keep =
            policy.periodSeconds *
            1000 *
            (policy.enforcer === "better-auth" ? policy.limit + 1 : 1);
          used[id] = [...(used[id] ?? []).filter((at) => now - at < keep), now];
        }
        writeFileSync(file, JSON.stringify(used));
      }
      return longest;
    });
    if (wait === 0) return;
    await pause(wait + 100);
  }
}

/** Runs `fn` while no other worker of the run holds the lock `name`. */
export function withRunLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  return locked(fn, `${name}.lock`);
}
