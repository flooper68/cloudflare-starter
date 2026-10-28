/**
 * Product analytics stays a small, typed, privacy-safe catalog
 * (docs/guides/how-to-setup-product-analytics.md): every event declared with defineEvent
 * is registered in packages/features/src/analytics-events.ts and tracked somewhere; every
 * event the code tracks or the SPA sends is in the catalog (client events with
 * `client: true`); no property name looks like personal data; every event fits the slot
 * limits; only the product-analytics feature calls the port; and the Analytics Engine
 * binding exists in every environment of wrangler.jsonc.
 */
import { parse } from "jsonc-parser";
import { describe, expect, it } from "vitest";

import {
  analyticsEvents,
  eventDefinitionProblems,
  IDENTIFY_TRAITS_LAYOUT,
  layoutProblems,
} from "../../packages/features/src";
import { filesUnder, read } from "./repo";

const SOURCE = /\.(ts|tsx)$/;
const TEST = /\.(test|stories)\.tsx?$|\.contract\.ts$/;

const sources = [
  ...filesUnder("apps/web/src", SOURCE),
  ...filesUnder("packages/features/src", SOURCE),
].filter((path) => !TEST.test(path));

const ROOT_CATALOG = "packages/features/src/analytics-events.ts";

/** `export const fooEvent = defineEvent("feature.thing_happened", …` in a domain. */
const DECLARATION = /export const (\w+) = defineEvent\(\s*["']([^"']+)["']/g;
const declarations = new Map<string, { name: string; path: string }>();
for (const path of sources.filter((p) => /\/domain\//.test(p))) {
  for (const [, identifier, name] of read(path).matchAll(DECLARATION)) {
    declarations.set(identifier as string, { name: name as string, path });
  }
}

/** trackEvent(deps, context, <definition>, …): the definition's identifier. */
const TRACK_CALL = /\btrackEvent\(\s*[^,]+,\s*(?:\{[^}]*\}|[^,]+),\s*(\w+)/g;
/** trackClientEvent("name", …) in the SPA. */
const CLIENT_CALL = /\btrackClientEvent\(\s*["']([^"']+)["']/g;

const tracked = new Map<string, string[]>();
const sentByClient = new Map<string, string[]>();
for (const path of sources) {
  const source = read(path);
  for (const [, identifier] of source.matchAll(TRACK_CALL)) {
    tracked.set(identifier as string, [
      ...(tracked.get(identifier as string) ?? []),
      path,
    ]);
  }
  for (const [, name] of source.matchAll(CLIENT_CALL)) {
    sentByClient.set(name as string, [
      ...(sentByClient.get(name as string) ?? []),
      path,
    ]);
  }
}

const catalog = [...analyticsEvents.values()];

describe("product analytics catalog", () => {
  it("finds declarations and call sites", () => {
    expect(declarations.size).toBeGreaterThan(0);
    expect(tracked.size).toBeGreaterThan(0);
    expect(sentByClient.size).toBeGreaterThan(0);
  });

  it.each([...declarations.values()])(
    "$name (declared in $path) is registered in the catalog",
    ({ name }) => {
      expect(
        analyticsEvents.has(name),
        `add it to ${ROOT_CATALOG}, or delete the declaration`
      ).toBe(true);
    }
  );

  it.each(catalog.map((event) => [event.name, event] as const))(
    "%s is declared in a feature's domain and tracked",
    (name, event) => {
      const declared = [...declarations.entries()].find(
        ([, declaration]) => declaration.name === name
      );
      expect(declared, "declare it with defineEvent in a domain/").toBeTruthy();
      if (event.client) {
        expect(
          sentByClient.has(name),
          `client event "${name}": call trackClientEvent("${name}", …) in the SPA, or remove it`
        ).toBe(true);
      } else {
        expect(
          tracked.has(declared?.[0] ?? ""),
          `nothing calls trackEvent(…, ${declared?.[0]}, …): track it or remove it from ${ROOT_CATALOG}`
        ).toBe(true);
      }
    }
  );

  it.each([...tracked.entries()])(
    "trackEvent(…, %s, …) tracks a catalog event",
    (identifier, paths) => {
      const name = declarations.get(identifier)?.name ?? "";
      expect(
        analyticsEvents.get(name)?.client,
        `${paths.join(", ")}: ${identifier} must be a server event (client: false) of ${ROOT_CATALOG}`
      ).toBe(false);
    }
  );

  it.each([...sentByClient.entries()])(
    'trackClientEvent("%s") sends a client event of the catalog',
    (name, paths) => {
      expect(
        analyticsEvents.get(name)?.client,
        `${paths.join(", ")}: add "${name}" with client: true to ${ROOT_CATALOG}`
      ).toBe(true);
    }
  );

  it.each(catalog.map((event) => [event.name, event] as const))(
    "%s fits the slot limits and carries no personal data",
    (_name, event) => {
      expect(eventDefinitionProblems(event)).toEqual([]);
    }
  );

  it("identify traits fit the limits and carry no personal data", () => {
    expect(layoutProblems(IDENTIFY_TRAITS_LAYOUT)).toEqual([]);
  });

  it("calls the ProductAnalytics port only from product-analytics/ and the platform", () => {
    const allowed =
      /^packages\/features\/src\/(product-analytics|platform)\/|^apps\/web\/src\/server\/platform\.ts$/;
    const offenders = sources.filter(
      (path) =>
        !allowed.test(path) &&
        /\banalytics\.(track|identify)\(/.test(read(path))
    );
    expect(
      offenders,
      "track with trackEvent / identifyUser from the product-analytics barrel"
    ).toEqual([]);
  });
});

type Block = Record<string, unknown>;
const config = parse(read("apps/web/wrangler.jsonc")) as Block & {
  env?: Record<string, Block>;
};
const environments: [string, Block][] = [
  ["top level", config],
  ...Object.entries(config.env ?? {}),
];
const datasetsOf = (block: Block) =>
  (block.analytics_engine_datasets as
    | { binding: string; dataset: string }[]
    | undefined) ?? [];

describe("Analytics Engine binding in wrangler.jsonc", () => {
  it.each(environments)("%s binds ANALYTICS_EVENTS", (_, block) => {
    expect(
      datasetsOf(block).find((entry) => entry.binding === "ANALYTICS_EVENTS")
        ?.dataset
    ).toMatch(/^[a-z][a-z0-9_]*$/);
  });

  it("gives each environment its own product events dataset", () => {
    const datasets = environments.map(
      ([, block]) =>
        datasetsOf(block).find((entry) => entry.binding === "ANALYTICS_EVENTS")
          ?.dataset
    );
    expect(new Set(datasets).size).toBe(environments.length);
  });
});
