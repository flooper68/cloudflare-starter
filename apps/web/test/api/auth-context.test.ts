import { afterEach, describe, expect, it, vi } from "vitest";

import { AUTH_CONTEXT_STALL_MS, getAuth } from "@/server/auth";
import type { AppEnv } from "@/server/env";

import { env } from "./helpers";

// Better Auth's `auth.$context` is one promise per isolate, created by the first request
// that calls getAuth and awaited by every later one. Building it queries D1 (the OAuth
// provider plugin's init). In Workers that query belongs to the first request: when that
// request ends early its I/O is cancelled and the promise never settles. Better Auth
// 1.7.14 has no option to build the context eagerly or per request, so getAuth replaces an
// instance whose context has not settled after AUTH_CONTEXT_STALL_MS.

const never = () => new Promise<never>(() => {});

/** D1 whose queries never answer while `hanging()` is true, as for a cancelled request. */
function switchableD1(real: D1Database, hanging: () => boolean): D1Database {
  return new Proxy(real, {
    get(target, property) {
      if (property === "prepare") {
        return (query: string) => {
          if (!hanging()) return target.prepare(query);
          const statement: Record<string, unknown> = {
            all: never,
            raw: never,
            first: never,
            run: never,
          };
          statement.bind = () => statement;
          return statement as unknown as D1PreparedStatement;
        };
      }
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

function settlesWithin(promise: Promise<unknown>, ms: number) {
  return Promise.race([
    promise.then(() => true),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), ms)),
  ]);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("getAuth and Better Auth's shared context", () => {
  it("building the context waits on D1 (why a stalled build must be replaced)", async () => {
    const stalledEnv: AppEnv = {
      ...env,
      DB: switchableD1(env.DB, () => true),
    };
    expect(await settlesWithin(getAuth(stalledEnv).$context, 1_000)).toBe(
      false
    );
  });

  it("replaces an instance whose context has not settled after the stall window", async () => {
    let hanging = true;
    const isolated: AppEnv = {
      ...env,
      DB: switchableD1(env.DB, () => hanging),
    };
    vi.useFakeTimers({ toFake: ["Date"] });
    const first = getAuth(isolated);
    expect(await settlesWithin(first.$context, 200)).toBe(false);

    // Within the window the same instance is served.
    vi.setSystemTime(Date.now() + AUTH_CONTEXT_STALL_MS - 1_000);
    expect(getAuth(isolated)).toBe(first);

    // After it, the next request builds a new one, which settles.
    hanging = false;
    vi.setSystemTime(Date.now() + 2_000);
    const second = getAuth(isolated);
    expect(second).not.toBe(first);
    expect(await settlesWithin(second.$context, 5_000)).toBe(true);

    // A settled instance is kept, however old.
    vi.setSystemTime(Date.now() + 10 * AUTH_CONTEXT_STALL_MS);
    expect(getAuth(isolated)).toBe(second);
  });
});
