# 0011. Component library in Linear's visual language, Storybook served by the web app

- Status: Accepted
- Date: 2026-10-28

## Context

Projects built from the starter need a full set of UI components (forms, overlays, data display, navigation, app-level patterns) that look coherent from day one and can be rebranded per project without editing components. Components need a place to be built and reviewed in isolation, and that place should be reachable in every environment without deploying and securing a separate Worker.

## Decision

`packages/ui` is the component library, in Linear's visual language: dark-first, dense, keyboard-first, quiet borders, one accent colour. Components are built on Radix primitives (plus `cmdk`, `sonner`, TanStack Table and others) and styled only with Tailwind classes mapped to CSS-variable tokens. A project's brand lives in two files in `packages/ui/src/brand/` (`brand.tsx` for name and logo, `brand.css` for accent, fonts, radius); the token system in `src/styles/` changes rarely. Rules are in [packages/ui/CONVENTIONS.md](../../packages/ui/CONVENTIONS.md).

Storybook config lives in `apps/storybook`; its static build is written to `apps/web/public/_storybook` during the web build and served by the web Worker at `/_storybook/` in every environment.

## Consequences

Positive:

- Rebranding is two files; components, the web app and Storybook follow.
- Accessibility and focus management come from Radix.
- Storybook is always deployed alongside the app version it documents, with no extra Worker or config.

Negative:

- The token vocabulary must be learned and respected (a GritQL rule enforces tokens-only classes).
- Storybook adds to the web build time and static assets.
- Storybook is public wherever the app is unless access is restricted ([how-to-use-storybook.md](../guides/how-to-use-storybook.md)).

## Alternatives considered

- **A handful of unstyled primitives per app.** Each app builds and styles its own components; they diverge and rebranding touches every component. Rejected.
- **A separate Storybook Worker.** Another Worker, `wrangler.jsonc` and deploy per environment, and its version can drift from the app's. Rejected.
