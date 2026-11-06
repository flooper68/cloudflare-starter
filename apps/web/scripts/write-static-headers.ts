/**
 * Writes apps/web/public/_headers, the security headers of the static assets, from
 * src/server/security-headers.ts. Run after changing the module:
 * `bun apps/web/scripts/write-static-headers.ts`. security-headers.test.ts fails while
 * the file is out of date.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { renderStaticHeaders } from "../src/server/security-headers";

const target = fileURLToPath(new URL("../public/_headers", import.meta.url));
writeFileSync(target, renderStaticHeaders());
console.log(`Wrote ${target}`);
