/**
 * <feature-map> (FeatureMap.astro): highlight, card, pillar filter, Map/List view and
 * keyboard. The markup is complete without it (map and list both show); this marks the
 * element `data-ready` and takes over.
 * - Hover or focus a node: its flows and neighbours light up, the card shows it.
 *   Clicking or focusing keeps it; leaving the map returns to the kept one.
 * - Arrow keys, Home and End move between the visible nodes (one tab stop, roving
 *   tabindex); Escape goes back to "Your app" and clears the filter.
 * - A pillar chip or a pillar's label filters the map to that pillar.
 */
class FeatureMapElement extends HTMLElement {
  private kept = "app";
  private filter = "";

  connectedCallback(): void {
    this.dataset.ready = "";
    this.dataset.view = "map";
    const canvas = this.querySelector<HTMLElement>(".fm-canvas");
    for (const node of this.nodes()) {
      node.addEventListener("pointerenter", () =>
        this.show(node.dataset.fmNode)
      );
      node.addEventListener("focus", () => this.keep(node));
      node.addEventListener("click", () => {
        this.keep(node);
        if (node.classList.contains("fm-pillar"))
          this.applyFilter(
            this.filter === node.dataset.pillar
              ? ""
              : (node.dataset.pillar ?? "")
          );
      });
    }
    canvas?.addEventListener("pointerleave", () => this.show(this.kept));
    canvas?.addEventListener("keydown", (event) => this.onKey(event));
    for (const chip of this.querySelectorAll<HTMLElement>("[data-fm-filter]"))
      chip.addEventListener("click", () =>
        this.applyFilter(chip.dataset.fmFilter ?? "")
      );
    for (const button of this.querySelectorAll<HTMLElement>("[data-fm-view]"))
      button.addEventListener("click", () => {
        this.dataset.view = button.dataset.fmView ?? "map";
        for (const other of this.querySelectorAll("[data-fm-view]"))
          other.setAttribute("aria-pressed", String(other === button));
      });
  }

  private nodes(): HTMLElement[] {
    return [...this.querySelectorAll<HTMLElement>("[data-fm-node]")].sort(
      (a, b) => Number(a.dataset.order) - Number(b.dataset.order)
    );
  }

  private visibleNodes(): HTMLElement[] {
    return this.nodes().filter(
      (node) => !node.classList.contains("is-filtered")
    );
  }

  private keep(node: HTMLElement): void {
    this.kept = node.dataset.fmNode ?? "app";
    for (const other of this.nodes()) {
      other.tabIndex = other === node ? 0 : -1;
      other.setAttribute("aria-current", String(other === node));
    }
    this.show(this.kept);
  }

  /** Highlights a node (a group, a pillar or the app) and shows its card. */
  private show(id = "app"): void {
    for (const card of this.querySelectorAll<HTMLElement>("[data-fm-card]"))
      card.hidden = card.dataset.fmCard !== id;
    if (id === "app") {
      delete this.dataset.active;
    } else {
      this.dataset.active = id;
    }
    const touches = (edge: SVGElement, end: "from" | "to") =>
      edge.dataset[end] === id || edge.dataset[`${end}Pillar`] === id;
    const near = new Set<string>();
    for (const edge of this.querySelectorAll<SVGElement>("[data-fm-edge]")) {
      const hot =
        id !== "app" && (touches(edge, "from") || touches(edge, "to"));
      edge.classList.toggle("is-hot", hot);
      if (hot) {
        near.add(edge.dataset.from ?? "");
        near.add(edge.dataset.to ?? "");
      }
    }
    for (const node of this.nodes()) {
      const self =
        node.dataset.fmNode === id ||
        (node.dataset.pillar === id && !node.classList.contains("fm-pillar"));
      const isNear = near.has(node.dataset.fmNode ?? "");
      node.classList.toggle("is-near", isNear && !self);
      node.classList.toggle(
        "is-dim",
        id !== "app" && !self && !isNear && node.dataset.fmNode !== "app"
      );
    }
  }

  private applyFilter(pillar: string): void {
    this.filter = pillar;
    const out = (value: string | undefined) =>
      pillar !== "" && value !== "" && value !== pillar;
    for (const node of this.nodes())
      node.classList.toggle("is-filtered", out(node.dataset.pillar));
    for (const area of this.querySelectorAll<HTMLElement>(".fm-area"))
      area.classList.toggle("is-filtered", out(area.dataset.pillar));
    for (const edge of this.querySelectorAll<SVGElement>("[data-fm-edge]"))
      edge.classList.toggle(
        "is-filtered",
        out(edge.dataset.fromPillar) && out(edge.dataset.toPillar)
      );
    for (const chip of this.querySelectorAll("[data-fm-filter]"))
      chip.setAttribute(
        "aria-pressed",
        String(chip.getAttribute("data-fm-filter") === pillar)
      );
    const current = this.nodes().find(
      (node) => node.dataset.fmNode === this.kept
    );
    if (current?.classList.contains("is-filtered")) {
      const app = this.nodes().find((node) => node.dataset.fmNode === "app");
      if (app) this.keep(app);
    }
  }

  private onKey(event: KeyboardEvent): void {
    const nodes = this.visibleNodes();
    const index = nodes.indexOf(document.activeElement as HTMLElement);
    const targets: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowDown: index + 1,
      ArrowLeft: index - 1,
      ArrowUp: index - 1,
      Home: 0,
      End: nodes.length - 1,
      Escape: 0,
    };
    const next = targets[event.key];
    if (next === undefined) return;
    event.preventDefault();
    if (event.key === "Escape") this.applyFilter("");
    nodes[(next + nodes.length) % nodes.length]?.focus();
  }
}

if (!customElements.get("feature-map"))
  customElements.define("feature-map", FeatureMapElement);
