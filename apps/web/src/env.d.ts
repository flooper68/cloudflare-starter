/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

declare namespace App {
  interface Locals {
    auth: () => {
      userId: string | null;
      redirectToSignIn: () => Response;
    };
    currentUser: () => Promise<{
      id: string;
      firstName?: string | null;
      lastName?: string | null;
      primaryEmailAddress?: {
        emailAddress: string;
      } | null;
    } | null>;
    runtime:
      | {
          env: {
            APP_QUEUE: Queue<
              import("@cloudflare-starter/features").AppQueueMessage
            >;
            HYPERDRIVE?: Hyperdrive;
            [key: string]: unknown;
          };
          cf?: IncomingRequestCfProperties;
        }
      | undefined;
  }
}
