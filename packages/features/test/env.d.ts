/// <reference types="@cloudflare/vitest-plugin/types" />

declare namespace Cloudflare {
  interface Env {
    readonly DB: D1Database;
    readonly FILES: R2Bucket;
    readonly APP_QUEUE: Queue<import("../src").QueueMessage>;
    readonly TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
  }
}
