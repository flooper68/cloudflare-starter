import type { Meta, StoryObj } from "@storybook/react-vite";

import { brand, Logo, LogoMark } from "../brand/brand";
import { Button } from "../components/button";

/**
 * The design foundations: brand, colour tokens, type scale and elevation. Everything is
 * defined by CSS variables in `src/styles/tokens.css` and `src/brand/brand.css`; switch
 * the theme in the toolbar to see both.
 */
const meta = {
  title: "Foundations",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function Swatch({
  name,
  token,
  className,
}: {
  readonly name: string;
  readonly token: string;
  readonly className: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className={`h-14 rounded-md border border-line ${className}`} />
      <div className="text-xs font-medium text-fg">{name}</div>
      <code className="font-mono text-2xs text-fg-subtle">{token}</code>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  readonly title: string;
  readonly description?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        {description ? (
          <p className="text-xs text-fg-muted">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export const Brand: Story = {
  render: () => (
    <div className="flex max-w-3xl flex-col gap-8">
      <Section
        title="Identity"
        description="src/brand/brand.tsx: name, tagline, logo. src/brand/brand.css: accent, fonts, radius."
      >
        <div className="flex items-center gap-6 rounded-lg border border-line bg-surface p-6">
          <LogoMark className="size-12" />
          <div className="flex flex-col gap-1">
            <Logo />
            <p className="text-sm text-fg-muted">{brand.tagline}</p>
          </div>
        </div>
      </Section>
      <Section
        title="Accent"
        description="One brand colour; hover, tint and focus ring derive from it."
      >
        <div className="grid grid-cols-4 gap-4">
          <Swatch name="Accent" token="--brand-accent" className="bg-accent" />
          <Swatch
            name="Accent hover"
            token="derived"
            className="bg-accent-hover"
          />
          <Swatch
            name="Accent subtle"
            token="derived"
            className="bg-accent-subtle"
          />
          <Swatch name="Focus ring" token="derived" className="bg-focus" />
        </div>
        <div className="flex gap-3">
          <Button variant="primary">Primary action</Button>
          <Button>Secondary</Button>
          <Button variant="link">Link</Button>
        </div>
      </Section>
      <Section
        title="Type"
        description={`Sans: ${brand.fonts.sans}. Mono: ${brand.fonts.mono}.`}
      >
        <p className="text-2xl font-semibold tracking-tight">
          The quick brown fox ships the release
        </p>
        <p className="font-mono text-sm text-fg-muted">
          ENG-1284 · fix(auth): rotate keys
        </p>
      </Section>
    </div>
  ),
};

/** The candidates sketched for the Starter mark; "Stack" shipped as LogoMark. */
const markOptions: readonly {
  readonly name: string;
  readonly note: string;
  readonly glyph: React.ReactNode;
}[] = [
  {
    name: "Stack (shipped)",
    note: "Three layers widening to a base: a stack ready to build on. Reads at 16px and is unlike other marks.",
    glyph: (
      <>
        <rect x="9" y="5.5" width="6" height="3" rx="1.5" />
        <rect x="7.25" y="10.5" width="9.5" height="3" rx="1.5" opacity=".8" />
        <rect x="5.5" y="15.5" width="13" height="3" rx="1.5" opacity=".6" />
      </>
    ),
  },
  {
    name: "Liftoff",
    note: "A chevron rising from a launch pad. Clear, but close to the generic 'collapse' and 'eject' icons.",
    glyph: (
      <>
        <path
          d="M7.25 13 12 8.25 16.75 13"
          fill="none"
          stroke="var(--brand-accent-fg)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="8.5" y="16" width="7" height="2.5" rx="1.25" opacity=".6" />
      </>
    ),
  },
  {
    name: "Steps",
    note: "Three rising blocks, a project taking its first steps. Reads as a bar chart, i.e. analytics.",
    glyph: (
      <>
        <rect x="5.5" y="14" width="3.5" height="4.5" rx="1" opacity=".6" />
        <rect x="10.25" y="10" width="3.5" height="8.5" rx="1" opacity=".8" />
        <rect x="15" y="5.5" width="3.5" height="13" rx="1" />
      </>
    ),
  },
];

/** The logo mark candidates, each at favicon, navigation and large size. */
export const MarkOptions: Story = {
  render: () => (
    <div className="flex max-w-3xl flex-col gap-4">
      {markOptions.map((option) => (
        <div
          key={option.name}
          className="flex items-center gap-6 rounded-lg border border-line bg-surface p-4"
        >
          {[16, 24, 48].map((size) => (
            <svg
              key={size}
              viewBox="0 0 24 24"
              width={size}
              height={size}
              fill="none"
              aria-hidden="true"
            >
              <rect width="24" height="24" rx="6" fill="var(--brand-accent)" />
              <g fill="var(--brand-accent-fg)">{option.glyph}</g>
            </svg>
          ))}
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-fg">{option.name}</h3>
            <p className="text-xs text-fg-muted">{option.note}</p>
          </div>
        </div>
      ))}
    </div>
  ),
};

export const Colors: Story = {
  render: () => (
    <div className="flex max-w-4xl flex-col gap-8">
      <Section
        title="Surfaces"
        description="From the page background up to floating panels."
      >
        <div className="grid grid-cols-4 gap-4">
          <Swatch name="Canvas" token="bg-canvas" className="bg-canvas" />
          <Swatch name="Surface" token="bg-surface" className="bg-surface" />
          <Swatch
            name="Raised"
            token="bg-surface-raised"
            className="bg-surface-raised"
          />
          <Swatch name="Overlay" token="bg-overlay" className="bg-overlay" />
          <Swatch name="Input" token="bg-input" className="bg-input" />
          <Swatch name="Hover" token="bg-hover" className="bg-hover" />
          <Swatch name="Active" token="bg-active" className="bg-active" />
          <Swatch name="Backdrop" token="bg-backdrop" className="bg-backdrop" />
        </div>
      </Section>
      <Section title="Text and lines">
        <div className="grid grid-cols-4 gap-4">
          <Swatch name="Foreground" token="text-fg" className="bg-fg" />
          <Swatch name="Muted" token="text-fg-muted" className="bg-fg-muted" />
          <Swatch
            name="Subtle"
            token="text-fg-subtle"
            className="bg-fg-subtle"
          />
          <Swatch
            name="Line strong"
            token="border-line-strong"
            className="bg-line-strong"
          />
        </div>
      </Section>
      <Section
        title="Status"
        description="Solid for icons and text, subtle for backgrounds."
      >
        <div className="grid grid-cols-4 gap-4">
          <Swatch name="Success" token="success" className="bg-success" />
          <Swatch name="Warning" token="warning" className="bg-warning" />
          <Swatch name="Danger" token="danger" className="bg-danger" />
          <Swatch name="Info" token="info" className="bg-info" />
          <Swatch
            name="Success subtle"
            token="success-subtle"
            className="bg-success-subtle"
          />
          <Swatch
            name="Warning subtle"
            token="warning-subtle"
            className="bg-warning-subtle"
          />
          <Swatch
            name="Danger subtle"
            token="danger-subtle"
            className="bg-danger-subtle"
          />
          <Swatch
            name="Info subtle"
            token="info-subtle"
            className="bg-info-subtle"
          />
        </div>
      </Section>
    </div>
  ),
};

const typeScale = [
  ["text-2xl", "24 / 32", "Page titles"],
  ["text-xl", "20 / 28", "Section titles"],
  ["text-lg", "16 / 24", "Dialog titles"],
  ["text-base", "14 / 22", "Card titles, emphasis"],
  ["text-sm", "13 / 20", "Body, controls (default)"],
  ["text-xs", "12 / 16", "Labels, metadata"],
  ["text-2xs", "11 / 16", "Keys, counters"],
] as const;

export const Typography: Story = {
  render: () => (
    <div className="flex max-w-3xl flex-col gap-4">
      {typeScale.map(([token, size, use]) => (
        <div
          key={token}
          className="grid grid-cols-[120px_80px_1fr] items-baseline gap-4 border-b border-line pb-3"
        >
          <code className="font-mono text-xs text-fg-subtle">{token}</code>
          <span className="text-xs text-fg-muted">{size}</span>
          <span className={`${token} font-medium text-fg`}>{use}</span>
        </div>
      ))}
      <div className="flex gap-6 pt-2 text-sm">
        <span className="font-normal">Regular 400</span>
        <span className="font-medium">Medium 500</span>
        <span className="font-semibold">Semibold 600</span>
      </div>
    </div>
  ),
};

export const Elevation: Story = {
  render: () => (
    <div className="grid max-w-3xl grid-cols-3 gap-6">
      {[
        ["Surface", "bg-surface border border-line"],
        ["Raised", "bg-surface-raised border border-line shadow-raised"],
        ["Overlay", "bg-overlay border border-line shadow-overlay"],
      ].map(([name, classes]) => (
        <div
          key={name}
          className={`flex h-28 items-end rounded-lg p-3 ${classes}`}
        >
          <span className="text-xs text-fg-muted">{name}</span>
        </div>
      ))}
      {["rounded-sm", "rounded-md", "rounded-lg", "rounded-xl"].map(
        (radius) => (
          <div
            key={radius}
            className={`flex h-16 items-center justify-center border border-line-strong bg-surface ${radius}`}
          >
            <code className="font-mono text-xs text-fg-muted">{radius}</code>
          </div>
        )
      )}
    </div>
  ),
};
