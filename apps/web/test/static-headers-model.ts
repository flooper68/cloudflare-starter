/**
 * A model of how Workers Static Assets applies `public/_headers` to a request, after
 * Cloudflare's asset worker (`attachCustomHeaders` in workers-shared, shipped in
 * miniflare) and https://developers.cloudflare.com/workers/static-assets/headers/:
 *
 * - every rule whose pattern matches the request path applies (`*` is a greedy splat,
 *   `:name` a placeholder that matches up to the next `/`);
 * - `! Name` deletes the header from the response so far;
 * - a header an earlier matching rule already set is appended (a second value), not
 *   replaced.
 *
 * The order the rules are applied in is not guaranteed to be the file's: production
 * applied `/` before `/*` (lexicographic order), and served the landing page with two
 * Content-Security-Policy headers. So the checks run every order in `RULE_ORDERS`.
 * Used by src/server/security-headers.test.ts and test/e2e-build/security-headers.spec.ts.
 */

export interface HeaderRule {
  readonly pattern: string;
  readonly set: readonly (readonly [string, string])[];
  readonly unset: readonly string[];
}

/** The rules of a `_headers` file, in file order. */
export function parseHeaders(text: string): HeaderRule[] {
  const rules: { pattern: string; set: [string, string][]; unset: string[] }[] =
    [];
  for (const line of text.split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      rules.push({ pattern: line.trim(), set: [], unset: [] });
      continue;
    }
    const rule = rules.at(-1);
    if (!rule) throw new Error(`header line before any path: ${line}`);
    const entry = line.trim();
    if (entry.startsWith("!")) {
      rule.unset.push(entry.slice(1).trim().toLowerCase());
    } else {
      const colon = entry.indexOf(":");
      rule.set.push([
        entry.slice(0, colon).trim().toLowerCase(),
        entry.slice(colon + 1).trim(),
      ]);
    }
  }
  return rules;
}

/** Whether a rule's path pattern matches a request path. */
export function patternMatches(pattern: string, pathname: string): boolean {
  const source = pattern
    .split(/(\*|:[A-Za-z]\w*)/)
    .map((part) => {
      if (part === "*") return ".*";
      if (/^:[A-Za-z]\w*$/.test(part)) return "[^/]+";
      return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("");
  return new RegExp(`^${source}$`).test(pathname);
}

/** The headers a request for `pathname` gets when the rules apply in this order. */
export function applyHeaders(
  rules: readonly HeaderRule[],
  pathname: string
): Map<string, string[]> {
  const headers = new Map<string, string[]>();
  const setByARule = new Set<string>();
  for (const rule of rules) {
    if (!patternMatches(rule.pattern, pathname)) continue;
    for (const name of rule.unset) headers.delete(name);
    for (const [name, value] of rule.set) {
      if (setByARule.has(name)) {
        headers.set(name, [...(headers.get(name) ?? []), value]);
      } else {
        headers.set(name, [value]);
        setByARule.add(name);
      }
    }
  }
  return headers;
}

export const RULE_ORDERS: Readonly<
  Record<string, (rules: readonly HeaderRule[]) => HeaderRule[]>
> = {
  file: (rules) => [...rules],
  lexicographic: (rules) =>
    [...rules].sort((a, b) =>
      a.pattern < b.pattern ? -1 : a.pattern > b.pattern ? 1 : 0
    ),
  reversed: (rules) => [...rules].reverse(),
};

/** Headers that must have exactly one value whatever the order. */
export const SINGLE_VALUED = [
  "content-security-policy",
  "x-frame-options",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
  "cross-origin-opener-policy",
  "cross-origin-resource-policy",
  "x-permitted-cross-domain-policies",
  "strict-transport-security",
] as const;

/**
 * What is wrong with the security headers of `pathname`: a header missing or doubled
 * in some order, or different between orders. Empty when the path is fine. Returns
 * the Content-Security-Policy too, so a caller can check which policy it is.
 */
export function securityHeaderProblems(
  rules: readonly HeaderRule[],
  pathname: string
): { problems: string[]; csp: string | undefined } {
  const problems: string[] = [];
  const results = Object.entries(RULE_ORDERS).map(
    ([order, arrange]) =>
      [order, applyHeaders(arrange(rules), pathname)] as const
  );
  for (const [order, headers] of results) {
    for (const name of SINGLE_VALUED) {
      const values = headers.get(name) ?? [];
      if (values.length !== 1) {
        problems.push(
          `${pathname}: ${values.length} ${name} header(s) in ${order} order`
        );
      }
    }
  }
  const [, first] = results[0];
  for (const [order, headers] of results.slice(1)) {
    for (const name of SINGLE_VALUED) {
      if (
        JSON.stringify(headers.get(name)) !== JSON.stringify(first.get(name))
      ) {
        problems.push(`${pathname}: ${name} differs in ${order} order`);
      }
    }
  }
  return { problems, csp: first.get("content-security-policy")?.[0] };
}

/** The request path a file of the build output is served at (`docs/x/index.html` → `/docs/x/`). */
export function servedPath(file: string): string {
  const path = `/${file.split("\\").join("/")}`;
  if (path.endsWith("/index.html")) return path.slice(0, -"index.html".length);
  if (path.endsWith(".html")) return path.slice(0, -".html".length);
  return path;
}
