// Colour theme of the public and account pages (landing, docs, 404, sign-in, ...); the
// /app theme is a user setting. Loaded as a blocking script in <head> (PublicLayout.astro,
// Layout.astro): it applies a saved choice before the first paint, so there is no flash.
// Without one the OS setting wins (tokens.css).
// - [data-theme-toggle] buttons switch between dark and light and save the choice;
// - [data-theme-set="dark|light|system"] buttons (the phone menu) pick one, "system"
//   forgets the saved choice; their aria-pressed shows the current one.
// An external file, not inline code, so a strict Content-Security-Policy needs no
// 'unsafe-inline' or nonce for it: the page policies allow this one path.
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
  const write = (value) => {
    try {
      if (value) localStorage.setItem(KEY, value);
      else localStorage.removeItem(KEY);
    } catch {
      // Private mode: the choice lasts for this page only.
    }
  };
  const saved = read();
  if (saved === "dark" || saved === "light") root.dataset.theme = saved;

  const current = () =>
    root.dataset.theme ??
    (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");

  const refresh = () => {
    const next = current() === "dark" ? "light" : "dark";
    for (const button of document.querySelectorAll("[data-theme-toggle]")) {
      button.setAttribute("aria-label", `Switch to the ${next} theme`);
      button.setAttribute("title", `Switch to the ${next} theme`);
    }
    const chosen = root.dataset.theme ?? "system";
    for (const button of document.querySelectorAll("[data-theme-set]"))
      button.setAttribute(
        "aria-pressed",
        String(button.getAttribute("data-theme-set") === chosen)
      );
  };

  const apply = (value) => {
    if (value === "dark" || value === "light") {
      root.dataset.theme = value;
      write(value);
    } else {
      delete root.dataset.theme;
      write(null);
    }
    refresh();
  };

  document.addEventListener("DOMContentLoaded", () => {
    refresh();
    for (const button of document.querySelectorAll("[data-theme-toggle]"))
      button.addEventListener("click", () =>
        apply(current() === "dark" ? "light" : "dark")
      );
    for (const button of document.querySelectorAll("[data-theme-set]"))
      button.addEventListener("click", () =>
        apply(button.getAttribute("data-theme-set"))
      );
    matchMedia("(prefers-color-scheme: light)").addEventListener(
      "change",
      refresh
    );
  });
})();
