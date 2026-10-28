# @cloudflare-starter/ui

The component library, in Linear's visual language: dark-first, dense, keyboard-first,
themed entirely by CSS variables. Browse it in Storybook (`bun run storybook`, or
`<APP_URL>/_storybook/` in any deployed environment).

```ts
import "@cloudflare-starter/ui/globals.css"; // once, in the app's root layout
import {
  Button,
  Dialog,
  DataTable,
  Toaster,
  toast,
} from "@cloudflare-starter/ui";
```

## Layout

```
src/
├── brand/        brand.tsx (name, logo) + brand.css (accent, fonts, radius): edit per project
├── styles/       tokens.css (neutrals, status, elevation; dark + light) + theme.css (Tailwind names)
├── lib/          cn() and shared class recipes (controls, menus, overlays, focus)
├── components/   one component per file, stories next to it; patterns/ for app-level pieces
├── exports/      barrels per group, re-exported by index.ts
└── stories/      foundations (brand, colours, type, elevation) and the intro page
```

- Theming and branding: [docs/how-to-define-branding.md](../../docs/how-to-define-branding.md)
- Rules for components and stories: [CONVENTIONS.md](CONVENTIONS.md)
- Storybook: [docs/how-to-use-storybook.md](../../docs/how-to-use-storybook.md)

Built on Radix primitives (`radix-ui`), `cmdk`, `sonner`, `@tanstack/react-table`,
`react-day-picker`, `@dnd-kit` and `lucide-react` icons. This package targets the browser;
server code belongs in [`packages/features`](../features/README.md).
