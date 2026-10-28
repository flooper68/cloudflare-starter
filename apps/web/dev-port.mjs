// The local dev server's port, one source of truth: the port of APP_URL in this checkout's
// apps/web/.dev.vars (Better Auth trusts only that origin, so the server must listen there).
// astro.config.mjs and playwright.config.ts both use it, so two checkouts with different
// APP_URLs run side by side and Playwright never talks to another checkout's server.
// `bun run setup:secrets` proposes a per-checkout port (docs/architecture/testing.md).
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const DEFAULT_DEV_PORT = 4321;

/** APP_URL's port from .dev.vars (or `devVarsPath`); 4321 without the file or the key. */
export function devPort(
  devVarsPath = fileURLToPath(new URL("./.dev.vars", import.meta.url))
) {
  if (!existsSync(devVarsPath)) return DEFAULT_DEV_PORT;
  const line = readFileSync(devVarsPath, "utf8")
    .split("\n")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith("APP_URL="));
  if (!line) return DEFAULT_DEV_PORT;
  try {
    const url = new URL(line.slice("APP_URL=".length).trim());
    return url.port ? Number(url.port) : DEFAULT_DEV_PORT;
  } catch {
    return DEFAULT_DEV_PORT;
  }
}
