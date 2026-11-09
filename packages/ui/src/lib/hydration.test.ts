import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Button } from "../components/button";
import { Checkbox } from "../components/checkbox";
import { HydrationGate, hydrationGated } from "./hydration";

const button = () => createElement(Button, null, "Use a recovery code");
const Island = hydrationGated(function Island() {
  return button();
});

describe("HydrationGate", () => {
  it("renders an island's buttons and checkboxes disabled and busy on the server", () => {
    const html = renderToString(
      createElement(
        HydrationGate,
        null,
        button(),
        createElement(Checkbox, { label: "Remember" })
      )
    );
    const controls = html.match(/<button[^>]*>/g) ?? [];
    expect(controls).toHaveLength(2);
    for (const control of controls) {
      expect(control).toMatch(/\sdisabled=""/);
      expect(control).toMatch(/aria-busy="true"/);
      expect(control).toMatch(/data-hydrating="true"/);
    }
  });

  it("leaves controls outside a gate alone (static markup, scripts drive them)", () => {
    const html = renderToString(button());
    expect(html).not.toMatch(/\sdisabled=|aria-busy=|data-hydrating=/);
  });

  it("hydrationGated wraps a component in the gate", () => {
    expect(renderToString(createElement(Island))).toMatch(/\sdisabled=""/);
    expect(Island.displayName).toBe("hydrationGated(Island)");
  });
});
