/**
 * The only script of the docs components kit (render.ts): tabbed code blocks become ARIA
 * tabs (arrow keys, Home and End move between tabs), and the prompt block gets its copy
 * button. Without it every tab panel shows under its label and the button stays hidden.
 * A bundled module (DocsLayout.astro), no inline code: CSP-clean.
 */

function setupTabs(root: HTMLElement): void {
  const list = root.querySelector<HTMLElement>('[role="tablist"]');
  if (!list) return;
  const tabs = [...list.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const panels = tabs.map((tab) =>
    document.getElementById(tab.getAttribute("aria-controls") ?? "")
  );
  const select = (index: number, focus: boolean) => {
    tabs.forEach((tab, at) => {
      const selected = at === index;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      const panel = panels[at];
      if (panel) panel.hidden = !selected;
    });
    if (focus) tabs[index]?.focus();
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => select(index, false));
    tab.addEventListener("keydown", (event) => {
      const last = tabs.length - 1;
      const next =
        event.key === "ArrowRight"
          ? index === last
            ? 0
            : index + 1
          : event.key === "ArrowLeft"
            ? index === 0
              ? last
              : index - 1
            : event.key === "Home"
              ? 0
              : event.key === "End"
                ? last
                : null;
      if (next === null) return;
      event.preventDefault();
      select(next, true);
    });
  });
  for (const panel of panels) panel?.setAttribute("tabindex", "0");
  list.hidden = false;
  root.dataset.ready = "";
  select(0, false);
}

function setupCopy(button: HTMLButtonElement): void {
  const block = button.closest(".dk-prompt");
  const label = button.querySelector("[data-dk-copy-label]");
  if (!block || !label || !navigator.clipboard) return;
  button.hidden = false;
  button.addEventListener("click", async () => {
    const source =
      block.querySelector("pre") ?? block.querySelector(".dk-prompt-head ~ *");
    const text = source?.textContent?.trim() ?? "";
    try {
      await navigator.clipboard.writeText(text);
      label.textContent = "Copied";
    } catch {
      label.textContent = "Select and copy";
    }
    window.setTimeout(() => {
      label.textContent = "Copy prompt";
    }, 2000);
  });
}

for (const root of document.querySelectorAll<HTMLElement>("[data-dk-tabs]"))
  setupTabs(root);
for (const button of document.querySelectorAll<HTMLButtonElement>(
  "[data-dk-copy]"
))
  setupCopy(button);
