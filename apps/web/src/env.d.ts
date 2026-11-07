/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

type AppEnvBindings = import("./server/env").AppEnv;

declare namespace Cloudflare {
  // `import { env } from "cloudflare:workers"` is typed with the app bindings.
  interface Env extends AppEnvBindings {}
}

interface ImportMetaEnv {
  /** True in a production build (CLOUDFLARE_ENV=production): robots.txt allows crawling. */
  readonly SITE_INDEXABLE: boolean;
}

declare namespace App {
  interface Locals {
    user: import("./server/auth").AuthSession["user"] | null;
    session: import("./server/auth").AuthSession["session"] | null;
    /** Set by middleware.ts for every on-demand request (not for prerendered pages). */
    requestContext: import("@cloudflare-starter/features").RequestContext;
  }
}
