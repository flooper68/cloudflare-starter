// The D1 provider's caching and failure behaviour, on the real local D1.
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { contractFlagContext } from "../../ports/feature-flags.contract";
import {
  createD1FeatureFlags,
  D1_FLAGS_RETRY_MS,
  D1_FLAGS_TTL_MS,
} from "./d1-feature-flags";

/** A clock the test moves by hand. */
function manualClock(start = Date.parse("2026-10-28T12:00:00.000Z")) {
  let now = start;
  return {
    now: () => new Date(now),
    advance: (ms: number) => {
      now += ms;
    },
  };
}

/** Wraps the D1 binding and counts the statements prepared on it. */
function countingD1(d1: D1Database) {
  let statements = 0;
  const wrapped = new Proxy(d1, {
    get(target, property) {
      if (property === "prepare") {
        return (query: string) => {
          statements += 1;
          return target.prepare(query);
        };
      }
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { d1: wrapped, statements: () => statements };
}

async function setFallthrough(key: string, value: boolean) {
  await env.DB.prepare(
    "INSERT INTO feature_flags (key, enabled, fallthrough_json, updated_at, updated_by) VALUES (?, 1, ?, 0, 'sql') ON CONFLICT(key) DO UPDATE SET fallthrough_json = excluded.fallthrough_json"
  )
    .bind(key, JSON.stringify(value))
    .run();
}

describe("createD1FeatureFlags", () => {
  it("loads all flags and rules in one query and serves them from memory for 30 s", async () => {
    await setFallthrough("ttl-a", true);
    await setFallthrough("ttl-b", false);
    const clock = manualClock();
    const counted = countingD1(env.DB);
    const flags = createD1FeatureFlags({ d1: counted.d1, clock });
    const context = contractFlagContext();

    expect(
      await flags.getBooleanDetails("ttl-a", false, context)
    ).toMatchObject({ value: true, reason: "STATIC" });
    await flags.getBooleanDetails("ttl-b", true, context);
    await flags.getStringDetails("not-stored", "x", context);
    expect(counted.statements()).toBe(1);

    // A change made elsewhere (another isolate, SQL) is not seen before the TTL ends.
    await setFallthrough("ttl-a", false);
    clock.advance(D1_FLAGS_TTL_MS - 1);
    expect((await flags.getBooleanDetails("ttl-a", false, context)).value).toBe(
      true
    );
    expect(counted.statements()).toBe(1);

    clock.advance(1);
    expect((await flags.getBooleanDetails("ttl-a", true, context)).value).toBe(
      false
    );
    expect(counted.statements()).toBe(2);
  });

  it("clears its cache on its own writes", async () => {
    const flags = createD1FeatureFlags({ d1: env.DB, clock: manualClock() });
    const context = contractFlagContext();
    expect(
      await flags.getBooleanDetails("invalidate", false, context)
    ).toMatchObject({ errorCode: "FLAG_NOT_FOUND" });
    await flags.update(
      "invalidate",
      { enabled: true, fallthrough: true },
      "user-ada"
    );
    expect(
      await flags.getBooleanDetails("invalidate", false, context)
    ).toMatchObject({ value: true, reason: "STATIC" });
    await flags.setRules(
      "invalidate",
      [{ kind: "workspace", workspaceId: "ws-ada", value: false }],
      "user-ada"
    );
    expect(
      await flags.getBooleanDetails("invalidate", true, context)
    ).toMatchObject({ value: false, reason: "TARGETING_MATCH" });
  });

  it("replaces rules in one batch, in order", async () => {
    const flags = createD1FeatureFlags({ d1: env.DB, clock: manualClock() });
    await flags.setRules(
      "ordered",
      [
        { kind: "percentage", percentageBp: 2500, value: "a" },
        { kind: "plan", planId: "business", value: "b" },
      ],
      "user-ada"
    );
    const stored = await flags.setRules(
      "ordered",
      [{ kind: "plan", planId: "team", value: "c" }],
      "user-ada"
    );
    expect(stored.rules).toEqual([
      { kind: "plan", planId: "team", value: "c" },
    ]);
    const count = await env.DB.prepare(
      "SELECT count(*) AS n FROM feature_flag_rules WHERE flag_key = 'ordered'"
    ).first<{ n: number }>();
    expect(count?.n).toBe(1);
  });

  it("degrades gracefully on stored JSON that does not parse: default with PARSE_ERROR, listed as invalid, overwritten by writes", async () => {
    await setFallthrough("parsed", true);
    await env.DB.prepare(
      "INSERT INTO feature_flags (key, enabled, fallthrough_json, updated_at, updated_by) VALUES ('broken-fallthrough', 1, 'on', 0, 'sql'), ('broken-rule', 1, 'true', 0, 'sql')"
    ).run();
    await env.DB.prepare(
      "INSERT INTO feature_flag_rules (id, flag_key, position, kind, workspace_id, value_json) VALUES ('broken-rule:0', 'broken-rule', 0, 'workspace', 'ws-ada', '{nope')"
    ).run();
    const flags = createD1FeatureFlags({ d1: env.DB, clock: manualClock() });
    const context = contractFlagContext();

    // Evaluation: the default, and the other flags still work.
    expect(
      await flags.getBooleanDetails("broken-fallthrough", false, context)
    ).toMatchObject({
      value: false,
      reason: "ERROR",
      errorCode: "PARSE_ERROR",
    });
    expect(
      (await flags.getBooleanDetails("parsed", false, context)).value
    ).toBe(true);

    // Listing: shown as invalid with the parse error, not hidden.
    const listed = await flags.list();
    expect(listed.find((flag) => flag.key === "broken-fallthrough")).toEqual({
      key: "broken-fallthrough",
      invalid: true,
      error: expect.stringContaining("JSON"),
      updatedAt: "1970-01-01T00:00:00.000Z",
      updatedBy: "sql",
    });
    expect(listed.find((flag) => flag.key === "broken-rule")).toMatchObject({
      invalid: true,
    });

    // setRules replaces the rules and resets a broken fallthrough to the default.
    expect(
      await flags.setRules(
        "broken-fallthrough",
        [{ kind: "workspace", workspaceId: "ws-ada", value: true }],
        "user-ada"
      )
    ).toMatchObject({
      enabled: true,
      fallthrough: null,
      rules: [{ kind: "workspace", workspaceId: "ws-ada", value: true }],
    });
    // update sets the fallthrough and drops rules that do not parse.
    expect(
      await flags.update(
        "broken-rule",
        { enabled: true, fallthrough: false },
        "user-ada"
      )
    ).toMatchObject({ enabled: true, fallthrough: false, rules: [] });
    expect(
      await flags.getBooleanDetails("broken-rule", true, context)
    ).toMatchObject({ value: false, reason: "STATIC" });
  });

  it("shares one query between concurrent evaluations on a cold cache", async () => {
    await setFallthrough("shared", true);
    const counted = countingD1(env.DB);
    const flags = createD1FeatureFlags({
      d1: counted.d1,
      clock: manualClock(),
    });
    const context = contractFlagContext();
    await Promise.all([
      flags.getBooleanDetails("shared", false, context),
      flags.getBooleanDetails("shared", false, context),
      flags.getStringDetails("other", "x", context),
    ]);
    expect(counted.statements()).toBe(1);
  });

  it("returns the default with GENERAL when D1 fails, reports it once and backs off", async () => {
    let attempts = 0;
    const failing = {
      prepare: () => {
        attempts += 1;
        throw new Error("D1 is unavailable");
      },
    } as unknown as D1Database;
    const clock = manualClock();
    const reported: unknown[] = [];
    const flags = createD1FeatureFlags({
      d1: failing,
      clock,
      onLoadError: (error) => reported.push(error),
    });
    const context = contractFlagContext();
    expect(await flags.getNumberDetails("any", 7, context)).toMatchObject({
      value: 7,
      reason: "ERROR",
      errorCode: "GENERAL",
    });
    await flags.getNumberDetails("any", 7, context);
    expect(attempts).toBe(1);
    expect(reported).toHaveLength(1);
    clock.advance(D1_FLAGS_RETRY_MS);
    await flags.getNumberDetails("any", 7, context);
    expect(attempts).toBe(2);
    expect(reported).toHaveLength(2);
  });
});
