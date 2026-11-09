/**
 * What the recorder draws over the app, injected with `page.addInitScript` into every
 * page of a recording and never shipped by the app: a visible cursor that follows the
 * (scripted) mouse with a ring on each click, and the "agent console", a small panel
 * listing the MCP calls the script's agent makes. Both live in a closed shadow root with
 * `pointer-events: none`, so they never take a click. State survives navigation through
 * sessionStorage. Self-contained: Playwright serialises the function.
 */

export interface ConsoleLine {
  readonly call: string;
  readonly result: string;
  readonly ok: boolean;
}

declare global {
  interface Window {
    __media?: {
      console(lines: readonly ConsoleLine[] | null): void;
    };
  }
}

export function installOverlay(): void {
  const CURSOR_KEY = "__media_cursor";
  const CONSOLE_KEY = "__media_console";
  const mount = () => {
    if (document.getElementById("__media-overlay")) return;
    const host = document.createElement("div");
    host.id = "__media-overlay";
    host.setAttribute("aria-hidden", "true");
    host.style.cssText =
      "position:fixed;inset:0;z-index:2147483647;pointer-events:none";
    const root = host.attachShadow({ mode: "closed" });
    root.innerHTML = `<style>
      .cursor{position:fixed;left:0;top:0;width:22px;height:22px;transform:translate(-3px,-2px);transition:none;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))}
      .ring{position:fixed;width:36px;height:36px;margin:-18px 0 0 -18px;border-radius:50%;border:2px solid #2dd4bf;opacity:0}
      .ring.on{animation:ring .45s ease-out}
      @keyframes ring{from{opacity:.9;transform:scale(.4)}to{opacity:0;transform:scale(1.4)}}
      .agent{position:fixed;right:24px;bottom:24px;width:420px;border-radius:12px;background:#0b0d10;border:1px solid #2a2f36;box-shadow:0 18px 50px rgba(0,0,0,.55);font:12px/18px ui-monospace,SFMono-Regular,Menlo,monospace;color:#d6dbe1;overflow:hidden}
      .agent[hidden]{display:none}
      .agent header{display:flex;align-items:center;gap:8px;padding:9px 12px;border-bottom:1px solid #2a2f36;background:#12161b;font:600 12px/16px system-ui,sans-serif;color:#f2f4f7}
      .agent header i{width:8px;height:8px;border-radius:50%;background:#2dd4bf;box-shadow:0 0 8px #2dd4bf}
      .agent header span{margin-left:auto;font-weight:400;color:#8b949e}
      .agent ol{margin:0;padding:8px 12px 10px;list-style:none;display:flex;flex-direction:column;gap:6px}
      .agent li{display:flex;flex-direction:column;gap:2px}
      .agent .call{color:#f2f4f7}.agent .call b{color:#2dd4bf;font-weight:500}
      .agent .res{color:#8b949e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .agent .res.err{color:#f59e8b}
    </style>
    <section class="agent" hidden><header><i></i>Agent console<span>Demo MCP client</span></header><ol></ol></section>
    <div class="ring"></div>
    <svg class="cursor" viewBox="0 0 24 24"><path d="M4 2.5v17.2l4.6-4.3 3 6.6 3.1-1.4-3-6.5h6.3z" fill="#fff" stroke="#0b0d10" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
    const cursor = root.querySelector<SVGElement>(".cursor") as SVGElement;
    const ring = root.querySelector<HTMLElement>(".ring") as HTMLElement;
    const agent = root.querySelector<HTMLElement>(".agent") as HTMLElement;
    const list = agent.querySelector("ol") as HTMLOListElement;

    const place = (x: number, y: number) => {
      cursor.style.left = `${x}px`;
      cursor.style.top = `${y}px`;
    };
    const saved = sessionStorage.getItem(CURSOR_KEY);
    if (saved) {
      const [x, y] = saved.split(",").map(Number);
      place(x ?? 0, y ?? 0);
    } else {
      place(-40, -40);
    }
    addEventListener(
      "mousemove",
      (event) => {
        place(event.clientX, event.clientY);
        sessionStorage.setItem(CURSOR_KEY, `${event.clientX},${event.clientY}`);
      },
      true
    );
    addEventListener(
      "mousedown",
      (event) => {
        ring.style.left = `${event.clientX}px`;
        ring.style.top = `${event.clientY}px`;
        ring.classList.remove("on");
        void ring.offsetWidth;
        ring.classList.add("on");
      },
      true
    );

    const render = (lines: readonly ConsoleLine[] | null) => {
      agent.hidden = !lines;
      list.replaceChildren();
      for (const line of lines ?? []) {
        const item = document.createElement("li");
        const call = document.createElement("span");
        call.className = "call";
        const name = /^(\S+)/.exec(line.call)?.[1] ?? line.call;
        const bold = document.createElement("b");
        bold.textContent = name;
        call.appendChild(document.createTextNode("→ "));
        call.appendChild(bold);
        call.appendChild(document.createTextNode(line.call.slice(name.length)));
        const result = document.createElement("span");
        result.className = line.ok ? "res" : "res err";
        result.textContent = `← ${line.result}`;
        item.appendChild(call);
        item.appendChild(result);
        list.appendChild(item);
      }
    };
    const stored = sessionStorage.getItem(CONSOLE_KEY);
    render(stored ? (JSON.parse(stored) as ConsoleLine[]) : null);
    window.__media = {
      console(lines) {
        if (lines) sessionStorage.setItem(CONSOLE_KEY, JSON.stringify(lines));
        else sessionStorage.removeItem(CONSOLE_KEY);
        render(lines);
      },
    };
    document.documentElement.appendChild(host);
  };
  if (document.documentElement) mount();
  document.addEventListener("DOMContentLoaded", mount);
}
