/**
 * The Web Analytics beacon of a prerendered page, decided at build time from the two
 * plain vars alone (WEB_ANALYTICS, WEB_ANALYTICS_TOKEN of the built environment). A
 * build has no secrets, so prerendered pages must not call buildPlatform, which
 * validates every setting and secret. Pages rendered per request use the platform's
 * `webAnalytics`, which follows the same rule.
 */
export function prerenderedWebAnalytics(vars: {
  readonly WEB_ANALYTICS?: string;
  readonly WEB_ANALYTICS_TOKEN?: string;
}): { readonly token: string } | null {
  return vars.WEB_ANALYTICS === "cloudflare" && vars.WEB_ANALYTICS_TOKEN
    ? { token: vars.WEB_ANALYTICS_TOKEN }
    : null;
}
