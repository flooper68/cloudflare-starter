import { Container, getContainer } from "@cloudflare/containers";

/**
 * The pi container: a Python HTTP server (server.py) that computes digits of pi in a child
 * process (pi_task.py). Sleeps after 30 s without a request; billing stops while it sleeps
 * (docs/guides/how-to-run-container-workflows.md#what-it-costs).
 */
export class PiContainer extends Container {
  defaultPort = 8080;
  sleepAfter = "30s";
  // pi needs nothing from the internet.
  enableInternet = false;
}

/** Instances the requests are spread over; equal to `max_instances` in wrangler.jsonc. */
export const PI_INSTANCES = 2;
/** The ceiling of pi_task.py (MAX_DIGITS). */
export const MAX_DIGITS = 100_000;

interface Env {
  readonly PI_CONTAINER: DurableObjectNamespace<PiContainer>;
}

/**
 * `GET /pi?digits=<1..100000>&instance=<0..1>`: forwards to one of the PI_INSTANCES
 * containers and returns its JSON (`{ ok, digits, pi, elapsedMs }`). Reached only through
 * the web app's service binding in deployed environments (`workers_dev: false`).
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "GET" || url.pathname !== "/pi") {
      return Response.json(
        { ok: false, error: "GET /pi?digits=<n>" },
        { status: 404 }
      );
    }
    const digits = Number(url.searchParams.get("digits") ?? "12");
    if (!Number.isInteger(digits) || digits < 1 || digits > MAX_DIGITS) {
      return Response.json(
        { ok: false, error: `digits must be between 1 and ${MAX_DIGITS}` },
        { status: 400 }
      );
    }
    const instance = Number(url.searchParams.get("instance") ?? "0");
    const index =
      Number.isInteger(instance) && instance >= 0 && instance < PI_INSTANCES
        ? instance
        : 0;
    const container = getContainer(env.PI_CONTAINER, `pi-${index}`);
    return container.fetch(
      new Request(`http://container/pi?digits=${digits}`, { method: "GET" })
    );
  },
};
