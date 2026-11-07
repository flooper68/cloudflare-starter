// Colour theme of the public pages (landing, docs, 404); the /app theme is a user setting.
// Loaded as a blocking script in <head> (PublicLayout.astro): it applies a saved choice
// before the first paint, so there is no flash. Without one the OS setting wins (tokens.css).
// The button [data-theme-toggle] switches between dark and light and saves the choice.
// An external file, not inline code, so a strict Content-Security-Policy needs no
// 'unsafe-inline' or nonce for it.
(() => {
  const KEY = "site-theme";
  const root = document.documentElement;
  const read = () => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  };
  const saved = read();
  if (saved === "dark" || saved === "light") root.dataset.theme = saved;

  const current = () =>
    root.dataset.theme ??
    (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");

  const label = (button) => {
    const next = current() === "dark" ? "light" : "dark";
    button.setAttribute("aria-label", `Switch to the ${next} theme`);
    button.setAttribute("title", `Switch to the ${next} theme`);
  };

  document.addEventListener("DOMContentLoaded", () => {
    for (const button of document.querySelectorAll("[data-theme-toggle]")) {
      label(button);
      button.addEventListener("click", () => {
        const next = current() === "dark" ? "light" : "dark";
        root.dataset.theme = next;
        try {
          localStorage.setItem(KEY, next);
        } catch {
          // Private mode: the choice lasts for this page only.
        }
        for (const other of document.querySelectorAll("[data-theme-toggle]"))
          label(other);
      });
    }
  });
})();
