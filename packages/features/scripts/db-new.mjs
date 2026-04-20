import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const name = process.argv[2];

if (!name) {
  console.error("Usage: bun run db:new <name>");
  process.exit(1);
}

const stamp = new Date()
  .toISOString()
  .replaceAll(/[-:TZ.]/g, "")
  .slice(0, 14);
const fileName = `${stamp}_${name.replaceAll(/\s+/g, "-")}.sql`;
const dir = new URL("../migrations", import.meta.url);

await mkdir(dir, { recursive: true });
await writeFile(join(dir.pathname, fileName), "-- Write SQL migration here.\n");
console.log(fileName);
