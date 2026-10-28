# @cloudflare-starter/ui

Shared UI primitives and global styles used by the web app and Storybook.

## Exports

| Import                               | What it is                     |
| ------------------------------------ | ------------------------------ |
| `@cloudflare-starter/ui`             | React components and helpers   |
| `@cloudflare-starter/ui/globals.css` | Tailwind entry + CSS variables |

Components live in [`src/components`](./src/components). Stories alongside each component are picked up by the Storybook workspace at [`apps/storybook`](../../apps/storybook/README.md).

## No server code

This package targets the browser. It depends on React and Tailwind — not on D1, R2, or any Cloudflare binding. Anything server-side belongs in [`packages/features`](../features/README.md).
