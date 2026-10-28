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
