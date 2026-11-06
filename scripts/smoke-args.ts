/**
 * Pure argument handling of `bun run test:smoke` (scripts/smoke.ts), unit-tested in
 * smoke-args.test.ts.
 */

export type SmokeArgs =
  | {
      readonly ok: true;
      /** The deployed app's origin, e.g. https://starter.flooper.me. */
      readonly baseURL: string;
      /** Everything else, passed on to `playwright test`. */
      readonly playwright: readonly string[];
    }
  | { readonly ok: false; readonly error: string };

const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/;

/**
 * Reads `--base-url <url>` / `--base-url=<url>` (or `E2E_BASE_URL`) from the arguments.
 * The URL must be https (http only for a local server) and is reduced to its origin, so
 * the suite's paths resolve against the site's root.
 */
export function parseSmokeArgs(
  argv: readonly string[],
  envBaseURL?: string
): SmokeArgs {
  const playwright: string[] = [];
  let raw = envBaseURL || undefined;
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index] as string;
    if (arg === "--") continue;
    if (arg === "--base-url") {
      index += 1;
      raw = argv[index];
      if (!raw) return { ok: false, error: "--base-url needs a value" };
    } else if (arg.startsWith("--base-url=")) {
      raw = arg.slice("--base-url=".length);
    } else {
      playwright.push(arg);
    }
  }
  if (!raw) {
    return {
      ok: false,
      error:
        "Pass the deployed URL: bun run test:smoke -- --base-url https://starter.flooper.me",
    };
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: `--base-url ${raw} is not a URL` };
  }
  const local = url.protocol === "http:" && LOCAL.test(url.hostname);
  if (url.protocol !== "https:" && !local) {
    return { ok: false, error: `--base-url ${raw} must be https` };
  }
  return { ok: true, baseURL: url.origin, playwright };
}

/**
 * The public URL of a deployed environment from its wrangler.jsonc block: the first route
 * with a hostname pattern (a custom domain or `host/*`), as https. Undefined when the
 * environment has none (develop on workers.dev): the deploy workflow then skips the smoke
 * run unless the GitHub variable APP_URL names the URL.
 */
export function deployedURL(
  block: Record<string, unknown>
): string | undefined {
  const routes = Array.isArray(block.routes) ? block.routes : [];
  for (const route of routes) {
    const pattern =
      typeof route === "string"
        ? route
        : typeof route === "object" && route !== null && "pattern" in route
          ? String((route as { pattern: unknown }).pattern)
          : "";
    const host = pattern.replace(/^https?:\/\//, "").split("/")[0] ?? "";
    if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host)) return `https://${host}`;
  }
  return undefined;
}
