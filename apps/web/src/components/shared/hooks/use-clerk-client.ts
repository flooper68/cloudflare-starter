import { $clerkStore, $userStore } from "@clerk/astro/client";
import { useSyncExternalStore } from "react";

export function useClerkInstance() {
  return useSyncExternalStore(
    $clerkStore.subscribe,
    () => $clerkStore.get(),
    () => null
  );
}

export function useUser() {
  return useSyncExternalStore(
    $userStore.subscribe,
    () => $userStore.get(),
    () => undefined
  );
}
