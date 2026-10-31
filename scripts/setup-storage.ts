/** Configure local source vars only; never contacts Cloudflare. Use --dry-run first. */
import { parseArgs } from "node:util";
import {
  ask,
  envBlock,
  envPath,
  fail,
  parseEnvironments,
  readWranglerConfig,
  setWranglerValue,
} from "./lib";

const { values } = parseArgs({
  options: {
    env: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});
const dryRun = values["dry-run"] ?? false;
const config = readWranglerConfig();
for (const env of parseEnvironments(values.env)) {
  const current =
    ((envBlock(config, env).vars ?? {}) as Record<string, string>)
      .STORAGE_RECONCILE ?? "";
  const mode = dryRun
    ? current
    : (await ask(
        `STORAGE_RECONCILE for ${env}: off, report or delete [${current}] > `
      )) || current;
  if (dryRun && !mode) {
    console.log(`${env}: not set; real run asks for off, report or delete`);
    continue;
  }
  if (!["off", "report", "delete"].includes(mode))
    fail(`${env}: STORAGE_RECONCILE must be off, report or delete`);
  setWranglerValue(envPath(env, "vars", "STORAGE_RECONCILE"), mode, dryRun);
  console.log(`${env}: STORAGE_RECONCILE=${mode}${dryRun ? " (dry run)" : ""}`);
}
