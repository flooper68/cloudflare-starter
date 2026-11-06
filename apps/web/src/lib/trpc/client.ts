import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";

import { connectivity, trackingFetch } from "@/lib/connectivity";
import type { AppRouter } from "@/server/trpc/router";

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      headers() {
        return {
          "x-trpc-source": "app",
        };
      },
      // A request that gets no response at all shows the shell's offline notice.
      fetch: (input, init) =>
        trackingFetch(connectivity, globalThis.fetch)(input, init),
    }),
  ],
});
