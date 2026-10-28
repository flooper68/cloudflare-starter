import type { SVGProps } from "react";

/**
 * The brand: name, tagline and logo used by the app and Storybook. Edit together with
 * brand.css. This is a mock brand ("Acme"); replace it per project
 * (docs/how-to-define-branding.md).
 */
export const brand = {
  name: "Acme",
  /** One line under the name: what the product does, for whom. */
  tagline: "Plan and ship work, with your agents.",
  /** Used in <title> and emails: "Page · Acme". */
  titleSeparator: " · ",
  /** Support address shown in footers and error pages. */
  supportEmail: "support@acme.example",
  /** Reference values for docs and Storybook; the CSS variables are the source. */
  colors: {
    accent: "#5e6ad2",
    accentForeground: "#ffffff",
  },
  fonts: { sans: "Inter Variable", mono: "Berkeley Mono / system mono" },
} as const;

export type Brand = typeof brand;

/** The logo mark alone, for favicons, avatars and collapsed navigation. */
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
      <path
        d="M7 16.5 11.2 7.5h1.6L17 16.5h-2.1l-.9-2.1h-4l-.9 2.1H7Zm3.7-3.8h2.6L12 9.6l-1.3 3.1Z"
        fill="var(--brand-accent-fg)"
      />
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
