/**
 * Astro integration (astro.config.mjs): after `astro build`, Pagefind indexes the
 * prerendered docs pages and writes its index and client into `<client>/pagefind/`,
 * served as static assets at /pagefind/. Only the element with `data-pagefind-body`
 * (the rendered Markdown of a docs page) is indexed. The search dialog loads
 * /pagefind/pagefind.js the first time it opens (src/docs/search.ts).
 */
import { fileURLToPath } from "node:url";

import type { AstroIntegration } from "astro";
import * as pagefind from "pagefind";

export function docsSearch(): AstroIntegration {
  return {
    name: "docs-search",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const { index, errors } = await pagefind.createIndex({
          forceLanguage: "en",
        });
        if (!index) throw new Error(`Pagefind: ${errors.join("; ")}`);
        const added = await index.addDirectory({
          path: root,
          glob: "docs/**/*.html",
        });
        if (added.errors.length > 0)
          throw new Error(`Pagefind: ${added.errors.join("; ")}`);
        if (added.page_count === 0)
          throw new Error("Pagefind indexed no docs pages");
        const written = await index.writeFiles({
          outputPath: `${root}/pagefind`,
        });
        if (written.errors.length > 0)
          throw new Error(`Pagefind: ${written.errors.join("; ")}`);
        await pagefind.close();
        logger.info(`Indexed ${added.page_count} docs pages into /pagefind/`);
      },
    },
  };
}
