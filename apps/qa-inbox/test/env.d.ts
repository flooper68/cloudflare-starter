/// <reference types="@cloudflare/vitest-plugin/types" />

declare namespace Cloudflare {
  interface Env {
    readonly INBOX: D1Database;
    readonly QA_EMAIL_DOMAIN: string;
    readonly QA_INBOX_TOKEN: string;
    readonly TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
  }
}
