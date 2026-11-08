# Branding: Acme to Starter

Evidence for the `branding-starter` PR.

- `before/`: `origin/main` at 3aae07e (the Acme brand).
- `after/`: the branch (Starter brand).
- `marks/`: the Storybook **Foundations › Mark Options** and **Foundations › Brand** stories in both themes.
- `after/favicon-*.png`: the served `/favicon.svg` at 16, 32 and 64 px under each OS colour scheme.

Each page in `before/` and `after/` exists as `-light` (1440×900), `-dark` (1440×900) and `-mobile` (390×844, light): `landing`, `docs` (the branding guide), `sign-in`, `dashboard` (a freshly signed-up user). `email-light` and `email-mobile` are a sample notification mail (role changed) rendered through `notificationMail` in `packages/features/src/notifications/domain/email-layout.ts`. The workspace "Acme Inc" in it is sample data, not the brand.

How they were made: `bun run dev:web` (local D1, the local Turnstile test widget), Playwright Chromium at device scale 2 with `colorScheme` emulation; Storybook from the built `/_storybook/` served by the dev server, `globals=theme:light|dark`.

Not included: the favicon in a real browser tab. Headless Chromium has no tab strip and no desktop browser was available to capture one, so `favicon-*.png` shows the same SVG file the tab loads.
