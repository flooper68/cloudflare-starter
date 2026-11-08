import type { SVGProps } from "react";

/**
 * The brand: name, tagline and logo used by the app and Storybook. Edit together with
 * brand.css. This is the starter's own brand ("Starter"); a project replaces it with its
 * product's (docs/guides/how-to-define-branding.md).
 */
export const brand = {
  name: "Starter",
  /** One line under the name: what the product does, for whom. */
  tagline: "Everything a new app needs on day one.",
  /** Used in <title> and emails: "Page · Starter". */
  titleSeparator: " · ",
  /** Support address shown in footers and error pages. */
  supportEmail: "support@starter.example",
  /**
   * Reference values for docs, emails and Storybook; the CSS variables are the source.
   * The light-theme values (white text on the deep teal); the dark theme uses a lighter
   * teal with dark text (brand.css).
   */
  colors: {
    accent: "#0a6e62",
    accentForeground: "#ffffff",
  },
  fonts: { sans: "Instrument Sans Variable", mono: "JetBrains Mono Variable" },
} as const;

export type Brand = typeof brand;

/**
 * The logo mark alone, for favicons, avatars and collapsed navigation: three stacked
 * layers on an accent tile, a stack ready to build on. Keep apps/web/public/favicon.svg
 * in sync with it.
 */
export function LogoMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <rect width="24" height="24" rx="6" fill="var(--brand-accent)" />
      <g fill="var(--brand-accent-fg)">
        <rect x="9" y="5.5" width="6" height="3" rx="1.5" />
        <rect x="7.25" y="10.5" width="9.5" height="3" rx="1.5" opacity=".8" />
        <rect x="5.5" y="15.5" width="13" height="3" rx="1.5" opacity=".6" />
      </g>
    </svg>
  );
}

/** Mark and name, for headers and sign-in pages. */
export function Logo({ className }: { readonly className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 font-semibold text-fg ${className ?? ""}`}
    >
      <LogoMark className="size-5" />
      <span className="text-sm tracking-tight">{brand.name}</span>
    </span>
  );
}
