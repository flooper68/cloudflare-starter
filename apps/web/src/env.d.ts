/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

type AppEnvBindings = import("./server/env").AppEnv;

declare namespace Cloudflare {
  // `import { env } from "cloudflare:workers"` is typed with the app bindings.
  interface Env extends AppEnvBindings {}
}

declare namespace App {
  interface Locals {
    user: import("./server/auth").AuthSession["user"] | null;
    session: import("./server/auth").AuthSession["session"] | null;
  }
}
