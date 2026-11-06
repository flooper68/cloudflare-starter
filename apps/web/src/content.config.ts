/**
 * Content collections. `docs`: the repository's Markdown that the docs site publishes
 * (DOCS.sources in src/docs/docs.config.ts), read from the repository root. Each entry's
 * id is its path from the root, e.g. `docs/guides/how-to-setup-d1.md`.
 */
import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";

import { DOCS } from "./docs/docs.config";

export const collections = {
  docs: defineCollection({
    loader: glob({
      pattern: [...DOCS.sources],
      base: "../..",
      generateId: ({ entry }) => entry,
    }),
  }),
};
