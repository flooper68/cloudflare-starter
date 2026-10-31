export interface NotificationDestination {
  readonly kind: "spa" | "document";
  readonly href: string;
}

/** Only app/admin routes belong to the SPA; downloads and documents use native HTTP navigation. */
export function notificationDestination(
  href: string | null,
  currentUrl: string
): NotificationDestination | null {
  if (!href?.trim()) return null;
  try {
    const current = new URL(currentUrl);
    const destination = new URL(href, current);
    if (destination.protocol !== "https:" && destination.protocol !== "http:")
      return null;
    const path = destination.pathname;
    const appRoute =
      path === "/app" ||
      path.startsWith("/app/") ||
      path === "/admin" ||
      path.startsWith("/admin/");
    if (destination.origin === current.origin && appRoute)
      return {
        kind: "spa",
        href: `${path}${destination.search}${destination.hash}`,
      };
    return { kind: "document", href: destination.href };
  } catch {
    return null;
  }
}
