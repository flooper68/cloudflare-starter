# How to define the brand

The UI is themed entirely by CSS variables. A project gets its own look by editing two files
in `packages/ui/src/brand/`; every component, the web app and Storybook follow.

The starter ships its own brand, **Starter** ("Everything a new app needs on day one."),
the identity of the public instance at `starter.flooper.me`: a deep teal accent (`#14a393`
in the dark theme, `#0a6e62` in the light one), a stacked-layers mark, Instrument Sans with
JetBrains Mono, 8px corners, dark-first. Longer copy calls it "Cloudflare Starter"
(`APP_NAME`, the docs `siteName`, `EMAIL_FROM_NAME`). It is the starter's identity, not
yours: replace it when you start a product, with the steps below.

## What Is Brand And What Is System

| Layer                                                                                                           | File                                            | Who changes it                                |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------- |
| **Brand**: name, tagline, logo, accent colour, fonts, corner radius                                             | `src/brand/brand.tsx`, `src/brand/brand.css`    | Every project                                 |
| **System**: neutral surfaces, text and line colours, status colours, elevation, type scale, motion, both themes | `src/styles/tokens.css`, `src/styles/theme.css` | Rarely; changes the feel of the whole library |
| **Components**                                                                                                  | `src/components/**`                             | Never for branding; they use tokens only      |

The split keeps a brand to a handful of decisions. If a brand change seems to need a component
edit, the component is missing a token; add the token instead.

## Step 1: Name, Tagline, Logo

Edit [`brand.tsx`](../../packages/ui/src/brand/brand.tsx):

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
(`apps/web/public/favicon.svg`) with the same mark; a favicon cannot read the page's CSS
variables, so give it the hex values, with a `prefers-color-scheme: dark` block when the
accent differs per theme (the shipped one does). Delete the **Foundations › Mark Options**
story, which shows the candidates sketched for the Starter mark.

Other places that carry the name: `DOCS.siteName` (`apps/web/src/docs/docs.config.ts`, the
docs header, the landing page and page titles) and `APP_NAME` (`apps/web/src/server/auth.ts`,
the name in emails and the shared workspace).

`brand.colors` and `brand.fonts` are only for docs and emails; the CSS file is the source of
truth.

## Step 2: Accent, Fonts, Radius

Edit [`brand.css`](../../packages/ui/src/brand/brand.css):

```css
:root {
  --brand-accent: #0f9d76;
  --brand-accent-fg: #ffffff;
  --brand-accent-text: #3cc89d; /* the accent as text on dark surfaces */
  --brand-font-sans: "Geist Variable", ui-sans-serif, system-ui, sans-serif;
  --brand-font-mono: "Geist Mono Variable", ui-monospace, monospace;
  --brand-radius: 8px;
}

[data-theme="light"] {
  --brand-accent: #0b8a67; /* a touch darker for contrast on white */
  --brand-accent-text: #08734f;
}
```

Repeat each light value in the `@media (prefers-color-scheme: light)` block of `brand.css`,
which applies when the page sets no `data-theme`. The comment at the top of `brand.css`
records the measured contrast of the shipped values; update it with yours.

What derives from these automatically (in `tokens.css`): accent hover, the subtle accent tint
(selected rows, chips), the focus ring, and the `sm/lg/xl` radii.

Choosing values:

- **Accent**: one colour, used sparingly (primary buttons, selection, focus, icons). It must
  reach 4.5:1 contrast with `--brand-accent-fg` for button text, and 3:1 against the canvas
  of each theme for focus rings and icons. Check both themes in Storybook (toolbar ›
  Theme) and with the a11y panel.
- **Accent text** (`--brand-accent-text`, Tailwind `text-accent-text`): the accent wherever it
  is text (links, an accent badge, a highlighted word). It must reach **4.5:1 on every surface
  of its theme**, including the accent tint `bg-accent-subtle` behind it, so it is usually a
  lighter accent in the dark theme and a darker one in the light theme. Use `text-accent` only
  for icons and other non-text marks (3:1). The component tests fail on any text below 4.5:1
  (axe `color-contrast`), so `bun run test:components` checks a new brand for you.
- **Fonts**: a variable sans with good small sizes (the UI is dense: 13px body). Install it
  self-hosted (e.g. `bun add @fontsource-variable/geist` in `packages/ui`) and import it at
  the top of `src/globals.css` in place of Instrument Sans and JetBrains Mono (remove those
  packages); avoid runtime font CDNs, which the CSP (`font-src 'self'`) blocks.
- **Accent foreground**: white on a dark accent is the usual choice. A light accent needs
  dark text instead; the shipped brand does that in the dark theme (`#03201c` on `#14a393`)
  and switches to white on the deeper light-theme teal, so it sets `--brand-accent-fg` in
  each theme block. The derived hover mixes the accent with white, so check the foreground
  on the hover too.
- **Radius**: 4–8px keeps the dense look; above 10px the controls start to look like a
  different product.

## Step 3: Check It

```bash
bun run storybook
```

Open **Foundations › Brand** and **Foundations › Colors** in both themes, then
**Patterns › Examples › Issue tracker** to see the brand on a whole screen. Then run
`bun run test:components`: every story runs axe, so a text colour below 4.5:1 anywhere fails
with the element and the measured ratio. Finally `bun run dev:web` for the app.

## Changing The System Layer (rarely)

`tokens.css` defines the neutrals for dark and light: canvas → surface → raised → overlay,
hover/active washes, lines, three text levels and the status colours. Change them when the
product needs a different feel (warmer greys, higher contrast), not for a logo colour. Keep
the same variable names; add new ones to both themes and map them in `theme.css` so they
become Tailwind classes.

Contrast rules the values must keep (WCAG AA; the component tests enforce them):

- `fg`, `fg-muted`, `fg-subtle` and the status colours (`success`, `warning`, `danger`, `info`)
  are text: 4.5:1 on every surface of their theme, including the tints (`bg-*-subtle`).
- White text sits on the `*-solid` fills (`bg-danger-solid` for the danger button, solid badges,
  avatar initials), not on the status colours themselves: each `--ui-*-solid` reaches 4.5:1
  with `--ui-on-solid`.

The default theme follows the OS; the app can force one with `<html data-theme="dark">` or
`"light"`.

## Checklist

- [ ] `brand.tsx`: name, tagline, support email, `LogoMark` SVG; the Mark Options story deleted
- [ ] `brand.css`: accent (+ light-theme tweak), accent foreground, accent text (4.5:1 in both
  themes), fonts, radius
- [ ] Font package installed and imported in `globals.css`
- [ ] `apps/web/public/favicon.svg` replaced
- [ ] `DOCS.siteName` (`apps/web/src/docs/docs.config.ts`) and the landing page copy
  (`apps/web/src/landing/content.ts`) use the new name
- [ ] Contrast checked in both themes: `bun run test:components` passes
- [ ] Email sender name (`EMAIL_FROM_NAME` in `apps/web/wrangler.jsonc`) and `APP_NAME`
  (`apps/web/src/server/auth.ts`, Better Auth's `appName` and the name in emails) use the
  new name
- [ ] The authenticator `issuer` and passkey `rpName` in `apps/web/src/server/auth-security.ts`
  (shown in authenticator apps and passkey prompts) use the new name
