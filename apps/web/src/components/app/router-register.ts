import type { AppRouter } from "@/components/app/routes";

declare module "@tanstack/react-router" {
  interface Register {
    router: AppRouter;
  }
}
