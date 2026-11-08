/**
 * The feature data stays whole: unique ids, every reference resolves, every docs slug is
 * a published docs page, the map stays small (owner's decision: about 8 to 12 nodes and
 * 10 to 12 edges), and each group's card lists 3 to 6 features.
 */
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { isPublished, slugFor } from "@/docs/links";

import {
  docsHref,
  EDGES,
  FEATURES,
  FLOWS,
  GROUPS,
  highlightsOf,
  PILLARS,
  worksWith,
} from "./features";

const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

function markdownFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === "node_modules" || name.startsWith(".")) return [];
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return markdownFiles(full);
    return name.endsWith(".md") ? [relative(ROOT, full)] : [];
  });
}

const PUBLISHED_SLUGS = new Set(
  markdownFiles(ROOT).filter(isPublished).map(slugFor)
);

const unique = (values: readonly string[]) =>
  new Set(values).size === values.length;

describe("feature data", () => {
  it("has unique ids", () => {
    expect(unique(PILLARS.map((entry) => entry.id))).toBe(true);
    expect(unique(GROUPS.map((entry) => entry.id))).toBe(true);
    expect(unique(FEATURES.map((entry) => entry.id))).toBe(true);
  });

  it("has four pillars and seven groups, each pillar with a group", () => {
    expect(PILLARS).toHaveLength(4);
    expect(GROUPS).toHaveLength(7);
    for (const entry of PILLARS)
      expect(GROUPS.some((g) => g.pillar === entry.id)).toBe(true);
  });

  it("puts every feature in a group of its pillar", () => {
    for (const entry of FEATURES) {
      const owner = GROUPS.find((g) => g.id === entry.group);
      expect(owner, entry.id).toBeDefined();
      expect(entry.pillar, entry.id).toBe(owner?.pillar);
      expect(entry.benefit.length, entry.id).toBeLessThanOrEqual(110);
    }
  });

  it("links every docs slug to a published page", () => {
    const slugs = [
      ...GROUPS.map((entry) => [entry.id, entry.docs] as const),
      ...FEATURES.map((entry) => [entry.id, entry.docs] as const),
    ];
    const missing = slugs.filter(([, slug]) => !PUBLISHED_SLUGS.has(slug));
    expect(missing).toEqual([]);
    expect(docsHref("guides/how-to-setup-mcp")).toBe(
      "/docs/guides/how-to-setup-mcp/"
    );
  });

  it("lists 3 to 6 features of the group itself on each group card", () => {
    for (const entry of GROUPS) {
      const highlights = highlightsOf(entry.id);
      expect(highlights.length, entry.id).toBeGreaterThanOrEqual(3);
      expect(highlights.length, entry.id).toBeLessThanOrEqual(6);
      for (const item of highlights) expect(item.group, item.id).toBe(entry.id);
    }
  });

  it("keeps the map small: 12 nodes, 10 to 12 edges with the hubs", () => {
    const nodes = 1 + PILLARS.length + GROUPS.length;
    expect(nodes).toBeLessThanOrEqual(12);
    // The map draws the flows plus one spoke from the app to each pillar.
    const edges = FLOWS.length;
    expect(edges).toBeGreaterThanOrEqual(8);
    expect(edges).toBeLessThanOrEqual(12);
    const ids = new Set(["app", ...GROUPS.map((entry) => entry.id)]);
    for (const flow of FLOWS) {
      expect(ids.has(flow.from), flow.from).toBe(true);
      expect(ids.has(flow.to), flow.to).toBe(true);
    }
    expect(FLOWS.some((flow) => flow.main)).toBe(true);
  });

  it("resolves every feature edge in both directions", () => {
    for (const edge of EDGES) {
      expect(worksWith(edge.a).some((item) => item.feature.id === edge.b)).toBe(
        true
      );
      expect(worksWith(edge.b).some((item) => item.feature.id === edge.a)).toBe(
        true
      );
    }
  });

  it("marks Containers as a demo, never as built", () => {
    expect(FEATURES.find((entry) => entry.id === "containers")?.status).toBe(
      "demo"
    );
  });
});
