# How to define the brand

::reviewed{date="2026-11-09"}

The UI is themed entirely by CSS variables: a project gets its own name, logo, accent, fonts and radius by editing two files in `packages/ui/src/brand/`, and every component, the app and Storybook follow. Use this guide to rebrand a project.

::flow[brand.tsx and brand.css -> Tokens -> Components -> App and Storybook]{title="Branding: two brand files feed the tokens, which every component, the app and Storybook use"}

## Rebrand in three steps

:::steps
1. **Name, tagline, logo** in `packages/ui/src/brand/brand.tsx`: the `brand` object, and the square SVG in `LogoMark` coloured with `var(--brand-accent)` or `currentColor`. Replace `apps/web/public/favicon.svg` with the same mark (hex colours: a favicon cannot read CSS variables).
2. **Accent, fonts, radius** in `packages/ui/src/brand/brand.css`: `--brand-accent`, `--brand-accent-fg`, `--brand-accent-text`, the fonts and `--brand-radius`, with the light-theme values in both light blocks.
3. **Check it:** `bun run storybook` (Foundations › Brand and Colors, both themes), then `bun run test:components`, which fails on any text below 4.5:1 contrast.
   :::

:::prompt{title="Paste this into your coding agent"}
```text
Rebrand the project as <name> ("<tagline>"), accent <colour>, font <font>: update brand.tsx,
brand.css, the logo mark and the favicon, DOCS.siteName and APP_NAME, then run the
component tests and fix any contrast failures in both themes.
```
:::

:::gotcha{title="The name lives in two more places"}
`DOCS.siteName` (`apps/web/src/docs/docs.config.ts`) and `APP_NAME` (`apps/web/src/server/auth.ts`, the name in emails).
:::

:::gotcha{title="Fonts are self-hosted"}
Install a variable font package in `packages/ui` and import it in `src/globals.css`. The content policy blocks font CDNs.
:::

:::decision{title="Brand and system are separate"}
Only the accent, fonts and radius are yours; the neutral palette and status colours are the system's, checked for contrast in every story.
:::

## Reference

What is brand and what is system, choosing values, changing the system layer and the checklist: [Branding reference](../reference/branding.md).
