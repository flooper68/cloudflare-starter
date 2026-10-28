import type { TurnstileApi } from "../components/human-check";

/**
 * A stand-in for Cloudflare Turnstile in stories and component tests: no network. Site
 * keys starting with `2x` fail like Cloudflare's always-fail test key; others pass with
 * the dummy token once "Verify you are human" is pressed.
 */
export const FAKE_TURNSTILE_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";
export const PASS_SITE_KEY = "1x00000000000000000000AA";
export const FAIL_SITE_KEY = "2x00000000000000000000AB";

export function fakeTurnstile(): TurnstileApi {
  const widgets = new Map<
    string,
    { container: HTMLElement; draw: () => void }
  >();
  let next = 0;

  return {
    render(container, options) {
      const id = `fake-${next++}`;
      const draw = () => {
        container.replaceChildren();
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "Verify you are human";
        button.className =
          "h-16 w-full rounded-md border border-line bg-surface px-3 text-left text-sm text-fg";
        button.onclick = () => {
          if (options.sitekey.startsWith("2x")) {
            options["error-callback"]?.();
            return;
          }
          button.replaceWith(
            Object.assign(document.createElement("p"), {
              className:
                "flex h-16 items-center rounded-md border border-line px-3 text-sm text-fg",
              textContent: "Success!",
            })
          );
          options.callback?.(FAKE_TURNSTILE_TOKEN);
        };
        container.append(button);
      };
      widgets.set(id, { container, draw });
      draw();
      return id;
    },
    reset(id) {
      widgets.get(id)?.draw();
    },
    remove(id) {
      widgets.get(id)?.container.replaceChildren();
      widgets.delete(id);
    },
  };
}

/** A loader for HumanCheck's `loadTurnstile` that resolves with the fake. */
export const loadFakeTurnstile = async () => fakeTurnstile();
