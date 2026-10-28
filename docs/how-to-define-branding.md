# How To Define The Brand

The UI is themed entirely by CSS variables. A project gets its own look by editing two files
in `packages/ui/src/brand/`; every component, the web app and Storybook follow.

The starter ships a mock brand, **Acme**: Linear-like lavender accent, Inter, 6px corners,
dark-first. Replace it when you start a product.

## What Is Brand And What Is System

| Layer                                                                                                           | File                                            | Who changes it                                |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------- |
| **Brand**: name, tagline, logo, accent colour, fonts, corner radius                                             | `src/brand/brand.tsx`, `src/brand/brand.css`    | Every project                                 |
| **System**: neutral surfaces, text and line colours, status colours, elevation, type scale, motion, both themes | `src/styles/tokens.css`, `src/styles/theme.css` | Rarely; changes the feel of the whole library |
| **Components**                                                                                                  | `src/components/**`                             | Never for branding; they use tokens only      |

The split keeps a brand to a handful of decisions. If a brand change seems to need a component
edit, the component is missing a token; add the token instead.

## Step 1: Name, Tagline, Logo

Edit [`brand.tsx`](../packages/ui/src/brand/brand.tsx):

```ts
export const brand = {
  name: "Northwind",
  tagline: "Inventory that keeps up with you.",
  titleSeparator: " · ",
  supportEmail: "support@northwind.example",
  colors: { accent: "#0f9d76", accentForeground: "#ffffff" },
  fonts: { sans: "Geist Variable", mono: "Geist Mono" },
} as const;
```

Replace the SVG in `LogoMark` with your mark. Keep it square (24×24 viewBox) and colour it
with `var(--brand-accent)` / `var(--brand-accent-fg)` or `currentColor`, so it follows the
theme. `Logo` renders the mark plus the name. Then replace the app's favicon
(`apps/web/public/favicon.svg`) with the same mark.

`brand.colors` and `brand.fonts` are only for docs and emails; the CSS file is the source of
truth.

## Step 2: Accent, Fonts, Radius

Edit [`brand.css`](../packages/ui/src/brand/brand.css):

```css
:root {
  --brand-accent: #0f9d76;
  --brand-accent-fg: #ffffff;
  --brand-font-sans: "Geist Variable", ui-sans-serif, system-ui, sans-serif;
  --brand-font-mono: "Geist Mono Variable", ui-monospace, monospace;
  --brand-radius: 8px;
}

[data-theme="light"] {
  --brand-accent: #0b8a67; /* a touch darker for contrast on white */
}
```

What derives from these automatically (in `tokens.css`): accent hover, the subtle accent tint
(selected rows, chips), the focus ring, and the `sm/lg/xl` radii.

Choosing values:

- **Accent**: one colour, used sparingly (primary buttons, selection, focus, links). It must
  reach 4.5:1 contrast with `--brand-accent-fg` for button text, and 3:1 against the canvas
  of each theme for focus rings and icons. Check both themes in Storybook (toolbar ›
  Theme) and with the a11y panel.
- **Fonts**: a variable sans with good small sizes (the UI is dense: 13px body). Install it
  self-hosted (e.g. `bun add @fontsource-variable/geist` in `packages/ui`) and import it at
  the top of `src/globals.css` in place of Inter; avoid runtime font CDNs.
- **Radius**: 4–8px keeps the dense look; above 10px the controls start to look like a
  different product.

## Step 3: Check It

```bash
bun run storybook
```

Open **Foundations › Brand** and **Foundations › Colors** in both themes, then
**Patterns › Examples › Issue tracker** to see the brand on a whole screen. Run the a11y
panel on Buttons and Forms. Finally `bun run dev:web` for the app.

## Changing The System Layer (rarely)

`tokens.css` defines the neutrals for dark and light: canvas → surface → raised → overlay,
hover/active washes, lines, three text levels and the status colours. Change them when the
product needs a different feel (warmer greys, higher contrast), not for a logo colour. Keep
the same variable names; add new ones to both themes and map them in `theme.css` so they
become Tailwind classes.

The default theme follows the OS; the app can force one with `<html data-theme="dark">` or
`"light"`.

## Checklist

- [ ] `brand.tsx`: name, tagline, support email, `LogoMark` SVG
- [ ] `brand.css`: accent (+ light-theme tweak), accent foreground, fonts, radius
- [ ] Font package installed and imported in `globals.css`
- [ ] `apps/web/public/favicon.svg` replaced
- [ ] Contrast checked in both themes
- [ ] Email sender name (`EMAIL_FROM_NAME` in `apps/web/wrangler.jsonc`) and Better Auth
  `appName` (`apps/web/src/server/auth.ts`) use the new name
