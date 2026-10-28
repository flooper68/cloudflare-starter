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
