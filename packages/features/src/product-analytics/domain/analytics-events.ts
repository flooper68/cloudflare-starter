import { z } from "zod";

import { defineEvent } from "../../kernel";

/**
 * The SPA showed a page. `route` is the route's path pattern (`/app/members`, with `$id`
 * placeholders), never the URL: no ids or query strings.
 */
export const pageViewedEvent = defineEvent(
  "app.page_viewed",
  { strings: ["route"], numbers: [] },
  z
    .object({
      route: z
        .string()
        .max(100)
        .regex(/^\/[A-Za-z0-9/$_-]*$/, "a route pattern, not a URL"),
    })
    .strict(),
  {
    client: true,
    description: "A page of the /app SPA was shown (route pattern only)",
  }
);

/** How the command palette was opened. */
export const COMMAND_PALETTE_SOURCES = ["shortcut", "trigger"] as const;

/** The kinds of command palette items: never an item's label, target or the query. */
export const COMMAND_PALETTE_ITEM_KINDS = [
  "navigate",
  "note",
  "workspace",
  "action",
] as const;

/** The SPA's command palette opened, by the ⌘K / Ctrl+K shortcut or the search trigger. */
export const commandPaletteOpenedEvent = defineEvent(
  "app.command_palette_opened",
  { strings: ["source"], numbers: [] },
  z.object({ source: z.enum(COMMAND_PALETTE_SOURCES) }).strict(),
  {
    client: true,
    description: "The command palette opened (shortcut or trigger)",
  }
);

/**
 * An item of the command palette was picked: only its kind (the palette group it is in),
 * never the query text, the item's label or where it leads.
 */
export const commandPaletteItemSelectedEvent = defineEvent(
  "app.command_palette_item_selected",
  { strings: ["kind"], numbers: [] },
  z.object({ kind: z.enum(COMMAND_PALETTE_ITEM_KINDS) }).strict(),
  {
    client: true,
    description: "A command palette item was picked (its kind only)",
  }
);
