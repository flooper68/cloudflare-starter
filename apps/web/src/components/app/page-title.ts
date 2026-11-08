import { createContext, useContext, useEffect } from "react";

/** Set by AppLayout: a page's own title for the browser tab, or null for the nav title. */
export const PageTitleContext = createContext<(title: string | null) => void>(
  () => {}
);

/**
 * Gives the browser tab this page's own title ("Q3 planning · Starter") instead of the
 * navigation title, while the page is shown. Pages whose title is their record's (one
 * note) call it; every other page gets its title from navigation.ts.
 */
export function usePageTitle(title: string | null | undefined): void {
  const setTitle = useContext(PageTitleContext);
  useEffect(() => {
    setTitle(title || null);
    return () => setTitle(null);
  }, [setTitle, title]);
}
