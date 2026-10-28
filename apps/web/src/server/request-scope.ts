/**
 * The request context of the HTTP request being handled, for code that runs inside a
 * library and cannot receive it as an argument (Better Auth hooks). server/http.ts runs
 * every request inside the scope; everything else receives the context explicitly.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import type { RequestContext } from "@cloudflare-starter/features";

/** Read lazily: the middleware sets the user on the context once it knows the session. */
export interface ScopedRequest {
  readonly context: RequestContext;
}

const storage = new AsyncLocalStorage<ScopedRequest>();

/** Runs `handle` with `scope` as the current request. */
export function runInRequestScope<T>(scope: ScopedRequest, handle: () => T): T {
  return storage.run(scope, handle);
}

/** The context of the request being handled, or null outside one (direct calls in tests). */
export function currentRequestContext(): RequestContext | null {
  return storage.getStore()?.context ?? null;
}
