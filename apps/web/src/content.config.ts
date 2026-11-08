/**
 * Content collections. `docs`: the repository's Markdown that the docs site publishes
 * (DOCS.sources in src/docs/docs.config.ts), read from the repository root. Each entry's
 * id is its path from the root, e.g. `docs/guides/how-to-setup-d1.md`.
 *
 * Astro keeps each rendered doc until its file changes. A doc's video player
 * (`<!-- walkthrough: <id> -->`, src/docs/walkthroughs.ts) is rendered from the media
 * manifest, so a changed manifest clears the collection and every doc renders again.
 */
import { defineCollection } from "astro:content";
import { glob, type Loader } from "astro/loaders";

import { MEDIA_MANIFEST } from "./content/media";
import { DOCS } from "./docs/docs.config";

/** A short, stable fingerprint of the media manifest. */
function manifestFingerprint(): string {
  const text = JSON.stringify(MEDIA_MANIFEST);
  let hash = 0;
  for (let index = 0; index < text.length; index++) {
    hash = (Math.imul(hash, 31) + text.charCodeAt(index)) | 0;
  }
  return `${text.length}:${hash >>> 0}`;
}

function docsLoader(): Loader {
  const files = glob({
    pattern: [...DOCS.sources],
    base: "../..",
    generateId: ({ entry }) => entry,
  });
  return {
    name: "docs",
    async load(context) {
      const fingerprint = manifestFingerprint();
      if (context.meta.get("media-manifest") !== fingerprint) {
        context.store.clear();
        context.meta.set("media-manifest", fingerprint);
      }
      await files.load(context);
    },
  };
}

export const collections = {
  docs: defineCollection({ loader: docsLoader() }),
};
