/**
 * `bun run budget` (after `bun run build`): checks the bundle budgets of
 * docs/architecture/performance.md#targets on apps/web/dist/client and prints each
 * page's first-load JS and the largest Pagefind files. Exits 1 when a budget is broken,
 * a page runs inline script code, or there is nothing to measure. Rules: scripts/bundle-budget.ts.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  kb,
  measurePagefind,
  measurePages,
  PAGE_JS_BUDGET,
  PAGEFIND_FILE_BUDGET,
} from "./bundle-budget";
import { fail, WEB } from "./lib";

const client = join(WEB, "dist", "client");
if (!existsSync(client))
  fail("No apps/web/dist/client: run `bun run build` first.");

const pages = measurePages(client);
const pagefind = measurePagefind(client);
if (pages.length === 0)
  fail("No prerendered pages found in apps/web/dist/client.");
if (pagefind.length === 0)
  fail("No Pagefind index in apps/web/dist/client/pagefind.");

const overPages = pages.filter((page) => page.bytes > PAGE_JS_BUDGET);
const inline = pages.filter((page) => page.inline.length > 0);
const overPagefind = pagefind.filter(
  (file) => file.bytes > PAGEFIND_FILE_BUDGET
);

const heaviest = [...pages].sort((a, b) => b.bytes - a.bytes);
console.log(
  `First-load JS per prerendered page (gzip, budget ${kb(PAGE_JS_BUDGET)}): ${pages.length} pages`
);
for (const page of heaviest.slice(0, 5))
  console.log(
    `  ${kb(page.bytes).padStart(9)}  ${page.page}  [${page.files.join(", ") || "no JS"}]`
  );
const largest = [...pagefind].sort((a, b) => b.bytes - a.bytes);
console.log(
  `Pagefind files (gzip, budget ${kb(PAGEFIND_FILE_BUDGET)} each): ${pagefind.length} files`
);
for (const file of largest.slice(0, 5))
  console.log(`  ${kb(file.bytes).padStart(9)}  ${file.file}`);

for (const page of overPages)
  console.error(`Over budget: ${page.page} loads ${kb(page.bytes)} of JS`);
for (const file of overPagefind)
  console.error(`Over budget: ${file.file} is ${kb(file.bytes)}`);
for (const page of inline)
  console.error(
    `Inline script on ${page.page} (move it into a file): ${page.inline.join(" | ")}`
  );
if (overPages.length > 0 || overPagefind.length > 0 || inline.length > 0)
  process.exit(1);
console.log("Bundle budgets: pass");
