/**
 * Closes the header's phone menu (a <details>, SiteMenu.astro) the way people expect a
 * menu to close: Escape (focus back on the button), a click outside it, or following
 * one of its links. Opening and closing otherwise is the browser's own.
 */
export function closeOnDismiss(menu: HTMLDetailsElement): void {
  const summary = menu.querySelector("summary");
  const close = (restoreFocus: boolean) => {
    if (!menu.open) return;
    menu.open = false;
    if (restoreFocus) summary?.focus();
  };
  menu.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    }
  });
  document.addEventListener("click", (event) => {
    if (event.target instanceof Node && !menu.contains(event.target))
      close(false);
  });
  for (const link of menu.querySelectorAll("a"))
    link.addEventListener("click", () => close(false));
}
