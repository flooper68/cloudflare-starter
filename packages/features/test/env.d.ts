/// <reference types="@cloudflare/vitest-plugin/types" />

declare namespace Cloudflare {
  interface Env {
    readonly DB: D1Database;
    readonly FILES: R2Bucket;
    readonly APP_QUEUE: Queue<import("../src").JobEnvelope>;
    readonly RL_TEST: RateLimit;
    readonly METRICS_DATASET: AnalyticsEngineDataset;
    readonly ANALYTICS_TEST: AnalyticsEngineDataset;
    readonly TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
  }
}
