/** Add the temporary-export lifecycle backstop. Preview first; real execution changes R2. */
import { parseArgs } from "node:util";
import {
  envBlock,
  envFlag,
  fail,
  parseEnvironments,
  readWranglerConfig,
  wrangler,
} from "./lib";

const { values } = parseArgs({
  options: {
    env: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});
const dryRun = values["dry-run"] ?? false;
const config = readWranglerConfig();
for (const environment of parseEnvironments(values.env)) {
  const buckets = (envBlock(config, environment).r2_buckets ?? []) as {
    binding: string;
    bucket_name: string;
    jurisdiction?: string;
  }[];
  const bucket = buckets.find((x) => x.binding === "FILES");
  if (!bucket) fail(`${environment}: FILES bucket missing`);
  console.log(
    `${environment}: expire temporary exports after two days; abort incomplete exports after one day (${bucket.bucket_name}).`
  );
  const result = wrangler(
    [
      "r2",
      "bucket",
      "lifecycle",
      "add",
      bucket.bucket_name,
      "privacy-exports",
      "exports/",
      "--expire-days",
      "2",
      "--abort-multipart-days",
      "1",
      ...envFlag(environment),
      ...(bucket.jurisdiction ? ["--jurisdiction", bucket.jurisdiction] : []),
    ],
    { dryRun }
  );
  if (!result.ok) fail(result.stderr || result.stdout);
  if (!dryRun) console.log(result.stdout);
}
