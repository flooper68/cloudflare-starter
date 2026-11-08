/**
 * `Cache-Control: no-transform` on every HTML response: the Cloudflare proxy then may not
 * modify the payload, so a zone's Web Analytics "automatic setup" injects no beacon
 * (https://developers.cloudflare.com/web-analytics/faq/), which the page policy would
 * block. The app loads the beacon itself when WEB_ANALYTICS=cloudflare.
 * docs/guides/how-to-configure-security-headers.md#edge-injected-web-analytics
 */

export const NO_TRANSFORM = "no-transform";

/**
 * A Cache-Control value with `no-transform` added and every other directive kept as it
 * was (`no-store`, `private`, `max-age`, ...). Adds nothing else: no `public`, which
 * would make a private or uncached response storable by shared caches.
 */
export function withNoTransform(cacheControl: string | null): string {
  const directives = (cacheControl ?? "")
    .split(",")
    .map((directive) => directive.trim())
    .filter(Boolean);
  if (
    !directives.some((directive) => directive.toLowerCase() === NO_TRANSFORM)
  ) {
    directives.push(NO_TRANSFORM);
  }
  return directives.join(", ");
}
