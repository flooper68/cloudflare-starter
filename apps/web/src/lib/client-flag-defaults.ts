import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/server/trpc/router";

/** The client flags as `flags.client` returns them. */
export type ClientFlags =
  inferRouterOutputs<AppRouter>["flags"]["client"]["flags"];

/**
 * The catalog defaults of the `client: true` flags, used in the browser while the flags
 * load and when loading them fails. A copy, so the browser bundle does not pull in the
 * server package; client-flag-defaults.test.ts keeps it equal to the catalog.
 */
export const CLIENT_FLAG_DEFAULTS: ClientFlags = {
  "upload-demo-presigned": true,
};
