import { Container, getContainer } from "@cloudflare/containers";

export class PiContainer extends Container {
  defaultPort = 8080;
  sleepAfter = "5m";
}

interface Env {
  readonly PI_CONTAINER: DurableObjectNamespace<PiContainer>;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("session") ?? "default";
    const container = getContainer(env.PI_CONTAINER, sessionId);

    return container.fetch(request);
  },
};
