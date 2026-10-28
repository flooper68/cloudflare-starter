import { useCallback, useEffect, useRef } from "react";

const focusable =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

/**
 * Makes a scroll container reachable by keyboard (WCAG 2.1.1, axe
 * `scrollable-region-focusable`) only while it needs it: when its content overflows and
 * nothing inside it can take focus. A form whose fields overflow keeps its first field as
 * the first tab stop; a long read-only list gets `tabindex="0"` so arrow keys can scroll it.
 * Pair the element with a visible focus style (`focusRing`).
 */
export function useKeyboardScrollable<T extends HTMLElement>() {
  const observer = useRef<ResizeObserver | null>(null);

  useEffect(() => () => observer.current?.disconnect(), []);

  return useCallback((element: T | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!element) return;
    const update = () => {
      const overflows =
        element.scrollHeight > element.clientHeight ||
        element.scrollWidth > element.clientWidth;
      const needsTabStop =
        overflows && element.querySelector(focusable) === null;
      if (needsTabStop) element.tabIndex = 0;
      else element.removeAttribute("tabindex");
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    observer.current = new ResizeObserver(update);
    observer.current.observe(element);
    for (const child of Array.from(element.children)) {
      observer.current.observe(child);
    }
  }, []);
}
