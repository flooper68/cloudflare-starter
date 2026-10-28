import { env } from "cloudflare:workers";

import { createDatabase, type Database, type RequestContext } from "../src";

/** The real Drizzle client over the test D1. */
export function testDb(): Database {
  return createDatabase(env.DB);
}

/** A clock frozen at a known time. */
export function fixedClock(iso = "2026-10-28T12:00:00.000Z") {
  return { now: () => new Date(iso) };
}

/** Ids that count up, so tests can predict them. */
export function sequentialIds(prefix = "00000000-0000-4000-8000-") {
  let next = 0;
  return { uuid: () => `${prefix}${String(++next).padStart(12, "0")}` };
}

/** Inserts a user (Better Auth's table) and returns it. */
export async function seedUser(
  name = "Nicole Example",
  email = `${name.toLowerCase().replace(/\s+/g, ".")}@example.test`
) {
  const id = `user-${email}`;
  await env.DB.prepare(
    "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)"
  )
    .bind(id, name, email, Date.now(), Date.now())
    .run();
  return { id, name, email };
}

/** A request context as the HTTP edge builds it, for use cases that record their origin. */
export function testRequestContext(
  overrides: Partial<RequestContext> = {}
): RequestContext {
  return {
    traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
    spanId: "00f067aa0ba902b7",
    parentSpanId: null,
    traceFlags: "01",
    source: "http",
    userId: null,
    workspaceId: null,
    ip: "203.0.113.7",
    release: "local",
    environment: "local",
    ...overrides,
  };
}
