/**
 * `bun run media:upload --env <local|develop|staging|production> [--dry-run] [--persist-to <dir>]`
 *
 * Uploads every video in src/content/media-manifest.json to the environment's FILES
 * bucket under `media/<hash>/` with Wrangler, from the recorder's output
 * (apps/web/tmp/media/out/<hash>/). Idempotent: a folder already complete in the bucket
 * (its `<id>.json` is there) is skipped, so only new recordings are sent. `local` writes
 * to the local R2 of `astro dev` (or `--persist-to`), to try the player before a deploy.
 * Remote environments use your Wrangler login or CLOUDFLARE_API_TOKEN and
 * CLOUDFLARE_ACCOUNT_ID. `--dry-run` prints the commands and changes nothing.
 * docs/guides/how-to-record-walkthrough-videos.md#upload
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { parse } from "jsonc-parser";

import { MEDIA_CACHE_CONTROL } from "../src/server/media";
import {
  filesBucket,
  MEDIA_ENVIRONMENTS,
  type MediaEnvironment,
  readManifest,
  uploadPlan,
} from "./lib/upload-plan";

const APP_DIR = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(APP_DIR, "tmp/media/out");

const { values } = parseArgs({
  options: {
    env: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    "persist-to": { type: "string" },
  },
});
const env = values.env as MediaEnvironment;
if (!MEDIA_ENVIRONMENTS.includes(env)) {
  console.error(`Pick an environment: --env ${MEDIA_ENVIRONMENTS.join(" | ")}`);
  process.exit(1);
}
const dryRun = values["dry-run"] ?? false;
const config = parse(readFileSync(join(APP_DIR, "wrangler.jsonc"), "utf8"));
const bucket = filesBucket(config, env);
const target =
  env === "local"
    ? [
        "--local",
        ...(values["persist-to"] ? ["--persist-to", values["persist-to"]] : []),
      ]
    : ["--remote", ...(env === "develop" ? [] : ["--env", env])];

function wrangler(args: readonly string[]) {
  return spawnSync("bunx", ["wrangler", ...args], {
    cwd: APP_DIR,
    encoding: "utf8",
    env: { ...process.env, CI: process.env.CI ?? "1" },
  });
}

const manifest = readManifest(join(APP_DIR, "src/content/media-manifest.json"));
const plan = uploadPlan(manifest);
console.log(
  `${dryRun ? "Dry run: " : ""}${plan.length} videos → ${bucket} (${env})`
);
let uploaded = 0;
for (const folder of plan) {
  const markerArgs = [
    "r2",
    "object",
    "get",
    `${bucket}/${folder.marker}`,
    "--pipe",
    ...target,
  ];
  if (!dryRun && wrangler(markerArgs).status === 0) {
    console.log(`  ${folder.id} (${folder.hash}): already uploaded`);
    continue;
  }
  for (const object of folder.objects) {
    const file = join(OUT, folder.hash, object.name);
    const args = [
      "r2",
      "object",
      "put",
      `${bucket}/${object.key}`,
      "--file",
      file,
      "--content-type",
      object.contentType,
      "--cache-control",
      MEDIA_CACHE_CONTROL,
      ...target,
    ];
    if (dryRun) {
      console.log(`  wrangler ${args.join(" ")}`);
      continue;
    }
    if (!existsSync(file)) {
      console.error(
        `  ${folder.id}: ${file} is missing. Record it first: bun run media:record --only ${folder.id}`
      );
      process.exit(1);
    }
    const result = wrangler(args);
    if (result.status !== 0) {
      console.error(
        `  ${object.key} failed:\n${result.stderr || result.stdout}`
      );
      process.exit(1);
    }
  }
  if (!dryRun) {
    uploaded += 1;
    console.log(`  ${folder.id} (${folder.hash}): uploaded`);
  }
}
if (!dryRun) console.log(`Done: ${uploaded} uploaded.`);
