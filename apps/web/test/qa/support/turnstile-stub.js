// The automated QA suite's stand-in for Cloudflare's Turnstile script (served by
// support/routing.ts in place of challenges.cloudflare.com/turnstile/v0/api.js). It hands
// the form a placeholder token so the submit button enables; the server ignores it, since
// the request carries X-QA-Token and names a QA address (the QA bypass). For any other
// address the server still asks Siteverify, which rejects the placeholder.
(() => {
  const widgets = new Map();
  let sequence = 0;
  function pass(widget) {
    clearTimeout(widget.timer);
    widget.container.textContent = "QA suite (human check bypassed)";
    widget.timer = setTimeout(
      () => widget.options.callback?.("qa-suite-placeholder"),
      100
    );
  }
  window.turnstile = {
    render(container, options) {
      const id = `qa-${++sequence}`;
      const widget = { container, options, timer: undefined };
      widgets.set(id, widget);
      pass(widget);
      return id;
    },
    reset(id) {
      const widget = widgets.get(id);
      if (widget) pass(widget);
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
