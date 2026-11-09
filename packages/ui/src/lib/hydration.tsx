import {
  type ComponentType,
  createContext,
  type ReactNode,
  useContext,
  useSyncExternalStore,
} from "react";

/**
 * A server-rendered island looks ready before it is: its buttons are in the HTML while
 * the JavaScript downloads and React hydrates, and a click in that window does nothing
 * (the browser has no handler yet, or React drops it mid-hydration). Inside a
 * `HydrationGate`, `Button` and `Checkbox` render `disabled` with `aria-busy` and
 * `data-hydrating` until React has committed the island, so they neither look nor act
 * ready early, and a disabled submit button also blocks the browser's own form
 * submission (Enter in a field), which would send the fields in the URL. A click then
 * waits for a control that works instead of vanishing.
 *
 * Only islands opt in (`hydrationGated`): outside a gate nothing changes, so React
 * markup that never hydrates (static Astro components, a button driven by a plain
 * script) and client-only renders (the app SPA) keep their controls enabled.
 */
const HydratingContext = createContext(false);

const subscribe = () => () => {};

/**
 * True while the surrounding `HydrationGate` is server-rendered or hydrating, false once
 * React has committed it (and always false outside a gate or in a client-only render).
 */
export function useHydrating(): boolean {
  return useContext(HydratingContext);
}

/**
 * Marks its subtree as hydrating until React commits it: the server snapshot (`true`)
 * is used for the server render and for hydration, so the markup matches, and React
 * re-renders with the client snapshot (`false`) right after the hydration commit. A
 * fresh client render (createRoot) uses the client snapshot from the start.
 */
export function HydrationGate({ children }: { readonly children: ReactNode }) {
  const hydrating = useSyncExternalStore(
    subscribe,
    () => false,
    () => true
  );
  return (
    <HydratingContext.Provider value={hydrating}>
      {children}
    </HydratingContext.Provider>
  );
}

/** Wraps an island's root component in a `HydrationGate` (use it for every `client:load`). */
export function hydrationGated<P extends object>(
  Component: ComponentType<P>
): ComponentType<P> {
  function Gated(props: P) {
    return (
      <HydrationGate>
        <Component {...props} />
      </HydrationGate>
    );
  }
  Gated.displayName = `hydrationGated(${Component.displayName ?? Component.name})`;
  return Gated;
}
