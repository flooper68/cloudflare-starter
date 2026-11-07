/** The body of /robots.txt (pages/robots.txt.ts). */

/** Paths crawlers skip even in production: nothing there is a public page. */
export const DISALLOWED = [
  "/app",
  "/api",
  "/admin",
  "/_storybook",
  "/health",
] as const;

export function robotsTxt(options: {
  /** True only for a production build. */
  readonly indexable: boolean;
  /** The site's origin, for the sitemap line. */
  readonly site: URL | null;
}): string {
  if (!options.indexable) return "User-agent: *\nDisallow: /\n";
  const lines = [
    "User-agent: *",
    ...DISALLOWED.map((path) => `Disallow: ${path}`),
  ];
  if (options.site)
    lines.push(
      "",
      `Sitemap: ${new URL("/sitemap-index.xml", options.site).href}`
    );
  return `${lines.join("\n")}\n`;
}
