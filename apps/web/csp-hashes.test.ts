import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  injectedStyleHashes,
  sonnerInjectedCss,
  styleHash,
} from "./csp-hashes.mjs";

describe("hashes of injected styles", () => {
  it("finds the stylesheet sonner injects", () => {
    const css = sonnerInjectedCss();
    expect(css).toContain("[data-sonner-toaster]");
    expect(css).not.toContain('\\"');
  });

  it("hashes a style's text as CSP does", () => {
    expect(styleHash("a{}")).toBe(
      `sha256-${createHash("sha256").update("a{}").digest("base64")}`
    );
    expect(injectedStyleHashes()).toEqual([styleHash(sonnerInjectedCss())]);
  });
});
