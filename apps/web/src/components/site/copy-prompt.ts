/**
 * <copy-prompt> (CopyPrompt.astro): copies the prompt with the Clipboard API; where it is
 * missing (an insecure origin, an old browser) or refused, selects the text so the
 * visitor can copy it with the keyboard. Says what happened in the status line.
 */
const RESET_MS = 2000;

class CopyPromptElement extends HTMLElement {
  connectedCallback(): void {
    const button = this.querySelector<HTMLButtonElement>("[data-copy]");
    const text = this.querySelector<HTMLElement>("[data-copy-text]");
    const label = this.querySelector<HTMLElement>("[data-copy-label]");
    const status = this.querySelector<HTMLElement>("[data-copy-status]");
    if (!button || !text || !label || !status) return;
    let timer = 0;

    const say = (buttonText: string, message: string) => {
      label.textContent = buttonText;
      status.textContent = message;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        label.textContent = "Copy prompt";
      }, RESET_MS);
    };

    const select = () => {
      const selection = window.getSelection();
      if (!selection) return;
      const range = document.createRange();
      range.selectNodeContents(text);
      selection.removeAllRanges();
      selection.addRange(range);
    };

    button.addEventListener("click", async () => {
      const prompt = text.textContent ?? "";
      try {
        if (!navigator.clipboard?.writeText) throw new Error("no clipboard");
        await navigator.clipboard.writeText(prompt);
        say("Copied", "Prompt copied. Paste it into your coding agent.");
      } catch {
        select();
        const key = /Mac|iPhone|iPad/.test(navigator.platform)
          ? "⌘C"
          : "Ctrl+C";
        say("Copy prompt", `The prompt is selected: press ${key} to copy it.`);
      }
    });
  }
}

if (!customElements.get("copy-prompt"))
  customElements.define("copy-prompt", CopyPromptElement);
