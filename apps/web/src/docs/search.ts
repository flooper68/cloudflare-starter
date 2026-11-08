/**
 * <docs-search> (components/site/DocsSearch.astro): opens the search dialog from its
 * trigger or ⌘K / Ctrl+K, loads Pagefind (/pagefind/pagefind.js, built by
 * search-integration.ts) on first use, and lists results as a combobox listbox:
 * ↑/↓ move, Enter or a click opens, Esc closes (the native <dialog>).
 */
import { type SearchResult, sectionLabel, toResult } from "./search-results";

interface PagefindResult {
  data(): Promise<{
    url: string;
    excerpt: string;
    meta: Record<string, string | undefined>;
  }>;
}

interface Pagefind {
  options(options: Record<string, unknown>): Promise<void>;
  debouncedSearch(
    term: string,
    options?: Record<string, unknown>,
    timeout?: number
  ): Promise<{ results: PagefindResult[] } | null>;
}

const PAGEFIND_URL = "/pagefind/pagefind.js";
const MAX_RESULTS = 8;

let pagefind: Promise<Pagefind> | null = null;

function loadPagefind(): Promise<Pagefind> {
  pagefind ??= import(/* @vite-ignore */ PAGEFIND_URL).then(
    async (module: Pagefind) => {
      await module.options({ excerptLength: 18 });
      return module;
    }
  );
  // A failed load (offline, or `astro dev`, which has no index) is retried next time.
  pagefind.catch(() => {
    pagefind = null;
  });
  return pagefind;
}

class DocsSearch extends HTMLElement {
  #dialog!: HTMLDialogElement;
  #input!: HTMLInputElement;
  #list!: HTMLUListElement;
  #status!: HTMLElement;
  #results: SearchResult[] = [];
  #active = -1;
  #query = "";

  connectedCallback() {
    this.#dialog = this.querySelector("dialog") as HTMLDialogElement;
    this.#input = this.querySelector("[data-search-input]") as HTMLInputElement;
    this.#list = this.querySelector('[role="listbox"]') as HTMLUListElement;
    this.#status = this.querySelector("[data-search-status]") as HTMLElement;

    this.querySelector("[data-search-open]")?.addEventListener("click", () =>
      this.open()
    );
    this.querySelector("[data-search-close]")?.addEventListener("click", () =>
      this.#dialog.close()
    );
    // A click on the backdrop (the dialog element itself, outside its content) closes.
    this.#dialog.addEventListener("click", (event) => {
      if (event.target === this.#dialog) this.#dialog.close();
    });
    this.#input.addEventListener("input", () => this.#search());
    this.#input.addEventListener("keydown", (event) => this.#onKey(event));
    this.#list.addEventListener("click", (event) => {
      const option = (event.target as Element).closest<HTMLElement>(
        '[role="option"]'
      );
      if (option?.dataset.url) location.assign(option.dataset.url);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        this.open();
      }
    });
  }

  open() {
    if (this.#dialog.open) return;
    this.#dialog.showModal();
    this.#input.focus();
    this.#input.select();
    loadPagefind().then(
      // A retry after a failed load clears the old error.
      () => {
        if (!this.#input.value.trim()) this.#setStatus(HINT);
      },
      () => this.#setStatus(LOAD_ERROR)
    );
  }

  async #search() {
    const query = this.#input.value.trim();
    this.#query = query;
    if (!query) {
      this.#render([]);
      this.#setStatus(HINT);
      return;
    }
    // The first search also loads Pagefind and its index: say that it is running.
    this.#setStatus("Searching…");
    try {
      const engine = await loadPagefind();
      const found = await engine.debouncedSearch(query, {}, 120);
      // null: a newer keystroke superseded this search.
      if (found === null || query !== this.#query) return;
      const data = await Promise.all(
        found.results.slice(0, MAX_RESULTS).map((result) => result.data())
      );
      if (query !== this.#query) return;
      const results = data.map(toResult);
      this.#render(results);
      this.#setStatus(
        results.length === 0
          ? `No results for “${query}”. Try fewer or other words.`
          : "",
        results.length === 0
          ? undefined
          : `${results.length} result${results.length === 1 ? "" : "s"}`
      );
    } catch {
      this.#render([]);
      this.#setStatus(LOAD_ERROR);
    }
  }

  #render(results: SearchResult[]) {
    this.#results = results;
    this.#active = results.length > 0 ? 0 : -1;
    this.#list.replaceChildren(
      ...results.map((result, index) => {
        const option = document.createElement("li");
        option.id = `docs-search-option-${index}`;
        option.setAttribute("role", "option");
        option.dataset.url = result.url;
        option.className =
          "flex cursor-pointer items-start gap-3 rounded-md px-2.5 py-2 text-sm text-fg aria-selected:bg-hover hover:bg-hover";
        const text = document.createElement("span");
        text.className = "flex min-w-0 flex-1 flex-col gap-0.5";
        const title = document.createElement("span");
        title.className = "font-medium";
        title.textContent = result.title;
        const excerpt = document.createElement("span");
        excerpt.className =
          "text-xs text-fg-muted [&_mark]:bg-transparent [&_mark]:font-semibold [&_mark]:text-fg";
        // Pagefind escapes the page text; the excerpt keeps only its <mark> tags.
        excerpt.innerHTML = result.excerpt;
        const section = document.createElement("span");
        section.className = "shrink-0 text-xs text-fg-muted";
        section.textContent = sectionLabel(result);
        text.appendChild(title);
        text.appendChild(excerpt);
        option.appendChild(text);
        option.appendChild(section);
        return option;
      })
    );
    this.#input.setAttribute("aria-expanded", String(results.length > 0));
    this.#highlight();
  }

  #highlight() {
    const options = this.#list.querySelectorAll('[role="option"]');
    options.forEach((option, index) => {
      option.setAttribute("aria-selected", String(index === this.#active));
    });
    const active = options[this.#active];
    if (active) {
      this.#input.setAttribute("aria-activedescendant", active.id);
      active.scrollIntoView({ block: "nearest" });
    } else {
      this.#input.removeAttribute("aria-activedescendant");
    }
  }

  #onKey(event: KeyboardEvent) {
    const count = this.#results.length;
    if (event.key === "ArrowDown" && count > 0) {
      event.preventDefault();
      this.#active = (this.#active + 1) % count;
      this.#highlight();
    } else if (event.key === "ArrowUp" && count > 0) {
      event.preventDefault();
      this.#active = (this.#active - 1 + count) % count;
      this.#highlight();
    } else if (event.key === "Enter") {
      const result = this.#results[this.#active];
      if (result) {
        event.preventDefault();
        location.assign(result.url);
      }
    }
  }

  /** `message` is shown; `announce` only goes to screen readers. */
  #setStatus(message: string, announce?: string) {
    this.#status.textContent = message;
    this.#status.classList.toggle("sr-only", !message && Boolean(announce));
    if (!message && announce) this.#status.textContent = announce;
  }
}

const HINT = "Type to search the guides, architecture and process docs.";
const LOAD_ERROR =
  "Search could not load. Check your connection and try again, or browse the navigation.";

if (!customElements.get("docs-search"))
  customElements.define("docs-search", DocsSearch);
