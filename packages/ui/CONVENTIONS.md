# UI conventions

The component library follows Linear's visual language: dark-first, dense (13px body, 32px
controls), quiet borders instead of heavy shadows, one accent colour, keyboard-first, fast
and subtle motion. Everything is themed by tokens; nothing hard-codes a colour.

## Files

- One component (or a small family) per file in `src/components/<kebab-name>.tsx`, its stories
  next to it in `<kebab-name>.stories.tsx`.
- Export from the group barrel in `src/exports/<group>.ts`, never from `src/index.ts` directly.
- No default exports. Props interfaces are exported as `<Name>Props`.

## Styling

- Tokens only (see `src/styles/theme.css`): `bg-canvas`, `bg-surface`, `bg-surface-raised`,
  `bg-overlay`, `bg-input`, `bg-hover`, `bg-active`, `border-line`, `border-line-strong`,
  `text-fg`, `text-fg-muted`, `text-fg-subtle`, `bg-accent`, `text-accent`, `text-accent-text`,
  `bg-accent-subtle`, `text-accent-fg`, `{bg,text,border}-{success,warning,danger,info}[-subtle]`,
  `bg-{success,warning,danger,info}-solid` with `text-on-solid`, `shadow-overlay`, `shadow-raised`, `rounded-{sm,md,lg,xl}`. Never `zinc-*`, `gray-*`,
  hex values, or `dark:` variants: the tokens switch with the theme.
- Reuse the recipes in `src/lib/styles.ts` (`controlBase`, `controlSize`, `overlayContent`,
  `menuItem`, `menuLabel`, `menuSeparator`, `backdrop`, `focusRing`) and compose with `cn()`.
- Sizes: `sm` (h-7), `md` (h-8, default), `lg` (h-9). Text: `text-2xs` 11px, `text-xs` 12px,
  `text-sm` 13px (body), `text-base` 14px.
- Icons: `lucide-react`, size 16 (`size-4`) in controls, `text-fg-muted` unless active.
- Motion: `animate-pop-in`/`animate-pop-out` for popovers and dialogs, `animate-fade-in` for
  backdrops, `animate-slide-in-right` for sheets. Nothing slower than 200ms.
- Every interactive element has a visible keyboard focus (`focusRing`) and a hover state.
- Contrast (WCAG AA, enforced by the component tests): text reaches 4.5:1 on its background in
  both themes. The accent as text is `text-accent-text`, never `text-accent` (that one is for
  icons, borders and fills, 3:1). White text goes on the `*-solid` fills (`bg-danger-solid
  text-on-solid`), not on the plain status colours. A tinted fill (`bg-*-subtle`) under small
  text is risky on hovered rows; prefer an opaque fill (avatar initials use the solid ones).
  Disabled controls use `text-fg-muted` rather than lowering opacity on text.

## Behaviour

- Build on Radix primitives (`import { Dialog as DialogPrimitive } from "radix-ui"`) for
  anything with focus management, portals or ARIA patterns; on `cmdk` for searchable lists.
- React 19: `ref` is a normal prop; no `forwardRef`.
- Controlled and uncontrolled where it makes sense (`value`/`defaultValue`/`onValueChange`,
  matching Radix naming).
- Accessible names: icon-only buttons need `label`; form controls work inside `<Field>` or take
  an `aria-label` (a placeholder is not a label). The visible text is part of the name (WCAG
  2.5.3): when `aria-label` adds context, start it with the visible text or put the extra words
  in `sr-only` text instead.
- Popover, menu and dialog panels have an accessible name: `aria-label` on `PopoverContent`
  (`panelLabel()` in `combobox.tsx` builds one from the trigger's label), a title in dialogs.
- Pick the ARIA pattern by what the rows hold. `listbox`/`option` only for plain choices: an
  option cannot contain buttons or other widgets, and a listbox holds nothing but options and
  groups, so empty, loading and error messages go next to it (`CommandList` in
  `src/lib/command-list.tsx` hides an empty cmdk list for you). Rows with their own buttons
  (issue rows, a kanban card's pickers) are a `grid` of `row`/`gridcell`s or a `group`.
- Tabs control panels: every `TabsTrigger` needs its `TabsContent`. A switch that only changes
  how one area renders (list or board) is a `SegmentedControl`, not tabs.
- A scroll container without focusable content must be reachable by keyboard
  (`useKeyboardScrollable` in `src/lib/use-keyboard-scrollable.ts` plus `focusRing`);
  `DialogBody` and `Table` do this already.
- Async components take a loader `(query: string, signal: AbortSignal) => Promise<Item[]>`,
  debounce, cancel stale requests, and show loading, empty and error states.

## Loading, empty and error states

Every view or widget that loads data handles four states: **loading** with a `Skeleton*`
shaped like the content (a spinner only for actions that take a moment, inside the button
that started them), **error** with `ErrorState` (a message that is safe to show and a way
forward: retry or somewhere else), **empty** with `EmptyState` (why it is empty and the next
step), and the content. `DataState` wires all four and requires each, so prefer it. Mutations
report failure with a toast or an inline `ErrorState`, never silently.

## Stories

- Title: `<Group>/<Component>`, groups: Foundations, Actions, Forms, Overlays, Feedback,
  Data display, Navigation, Patterns.
- `tags: ["autodocs"]` and a JSDoc comment on the component (it becomes the docs page).
- At least: `Playground` (args + controls), every variant/size, states (disabled, loading,
  error, empty), and one realistic example in context (e.g. inside a Card or a form).
- Realistic content: issue titles, people, projects. No lorem ipsum.
- Overlays: provide a story that renders open (`defaultOpen`) so the docs page shows it.
- Stories are tests (`bun run test:components`): each must pass axe in Chromium, and each
  interaction gets a `play` function (`storybook/test`) in a story named for what it proves
  (`SearchAndPick`, `KeyboardNavigation`). Never disable an axe rule globally; see
  [testing.md](../../docs/architecture/testing.md#component-tests) for the one exception.
