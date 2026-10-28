/**
 * Bindings are not inherited by `env.*` in wrangler.jsonc: every environment must declare
 * the same bindings and vars as the top level (develop).
 */
import { parse } from "jsonc-parser";
import { describe, expect, it } from "vitest";

import { read } from "./repo";

type Block = Record<string, unknown>;
const config = parse(read("apps/web/wrangler.jsonc")) as Block & {
  env?: Record<string, Block>;
};

function bindings(block: Block): Record<string, string[]> {
  const names = (key: string, field: string) =>
    ((block[key] as Block[] | undefined) ?? [])
      .map((entry) => String(entry[field]))
      .sort();
  const queues = (block.queues as Record<string, Block[]> | undefined) ?? {};
  return {
    d1: names("d1_databases", "binding"),
    r2: names("r2_buckets", "binding"),
    sendEmail: names("send_email", "name"),
    queueProducers: (queues.producers ?? [])
      .map((q) => String(q.binding))
      .sort(),
    queueConsumers: (queues.consumers ?? []).map(() => "consumer"),
    crons: block.triggers ? ["crons"] : [],
    vars: Object.keys((block.vars as Block | undefined) ?? {})
      .filter((name) => name !== "EMAIL_FROM")
      .sort(),
  };
}

describe("wrangler.jsonc", () => {
  const environments = Object.entries(config.env ?? {});

  it("defines staging and production", () => {
    expect(environments.map(([name]) => name).sort()).toEqual([
      "production",
      "staging",
    ]);
  });

  it.each(environments)(
    "env.%s declares every binding and var of the top level",
    (_, block) => {
      expect(bindings(block)).toEqual(bindings(config));
    }
  );
});
