// Browser-side simulation for E2E only. The real server verifier still validates
// the dummy token through test/outbound.ts. Unknown site keys fail closed.
(() => {
  const widgets = new Map();
  let sequence = 0;
  function verify(widget) {
    clearTimeout(widget.timer);
    widget.container.textContent = "Local test verification…";
    widget.timer = setTimeout(() => {
      if (widget.options.sitekey === "1x00000000000000000000AA") {
        widget.container.textContent = "Verified (local test)";
        widget.options.callback?.("XXXX.DUMMY.TOKEN.XXXX");
      } else {
        widget.container.textContent = "Verification failed (local test)";
        widget.options["error-callback"]?.();
      }
    }, 1000);
  }
  window.turnstile = {
    render(container, options) {
      const id = `local-${++sequence}`;
      const widget = { container, options, timer: undefined };
      widgets.set(id, widget);
      verify(widget);
      return id;
    },
    reset(id) {
      const widget = widgets.get(id);
      if (widget) verify(widget);
    },
    remove(id) {
      const widget = widgets.get(id);
      if (!widget) return;
      clearTimeout(widget.timer);
      widget.container.textContent = "";
      widgets.delete(id);
    },
  };
})();
