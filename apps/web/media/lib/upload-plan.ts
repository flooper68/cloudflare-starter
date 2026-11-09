/**
 * What `bun run media:upload` puts into R2: for every video in the manifest, the files of
 * its folder `media/<hash>/`, the entry's own JSON last. The JSON is the folder's
 * "complete" marker: a folder whose JSON is already in the bucket is skipped, so the
 * upload is idempotent and an interrupted one is finished by the next run.
 */
import { readFileSync } from "node:fs";

import type { MediaEntry, MediaManifest } from "../../src/content/media";
import { MEDIA_KEY_PREFIX, MEDIA_TYPES } from "../../src/server/media";

export const MEDIA_ENVIRONMENTS = [
  "local",
  "develop",
  "staging",
  "production",
] as const;
export type MediaEnvironment = (typeof MEDIA_ENVIRONMENTS)[number];

export interface UploadObject {
  /** R2 key: `media/<hash>/<file>`. */
  readonly key: string;
  /** The file name inside the recorder's output folder. */
  readonly name: string;
  readonly contentType: string;
}

export interface UploadFolder {
  readonly id: string;
  readonly hash: string;
  /** The JSON marker's key. */
  readonly marker: string;
  /** Media first, the marker last. */
  readonly objects: readonly UploadObject[];
}

function fileNames(entry: MediaEntry): string[] {
  const name = (src: string) => src.slice(src.lastIndexOf("/") + 1);
  return [
    ...entry.sources.map((source) => name(source.src)),
    name(entry.poster.src),
    ...(entry.captions ? [name(entry.captions.src)] : []),
  ];
}

export function uploadPlan(manifest: MediaManifest): UploadFolder[] {
  return Object.values(manifest.videos).map((entry) => {
    const object = (name: string): UploadObject => {
      const extension = name.slice(name.lastIndexOf(".") + 1);
      const contentType = MEDIA_TYPES[extension];
      if (!contentType) throw new Error(`${entry.id}: unknown file ${name}`);
      return {
        key: `${MEDIA_KEY_PREFIX}${entry.hash}/${name}`,
        name,
        contentType,
      };
    };
    const marker = object(`${entry.id}.json`);
    return {
      id: entry.id,
      hash: entry.hash,
      marker: marker.key,
      objects: [...fileNames(entry).map(object), marker],
    };
  });
}

/** The bucket bound as FILES in an environment of wrangler.jsonc (develop: top level). */
export function filesBucket(
  config: {
    r2_buckets?: { binding: string; bucket_name: string }[];
    env?: Record<
      string,
      { r2_buckets?: { binding: string; bucket_name: string }[] }
    >;
  },
  env: MediaEnvironment
): string {
  const buckets =
    env === "local" || env === "develop"
      ? config.r2_buckets
      : config.env?.[env]?.r2_buckets;
  const name = buckets?.find(
    (bucket) => bucket.binding === "FILES"
  )?.bucket_name;
  if (!name) throw new Error(`no FILES bucket for ${env} in wrangler.jsonc`);
  return name;
}

export function readManifest(path: string): MediaManifest {
  return JSON.parse(readFileSync(path, "utf8")) as MediaManifest;
}
