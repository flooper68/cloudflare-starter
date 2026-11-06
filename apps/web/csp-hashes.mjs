// Hashes of inline styles that libraries inject at runtime, for the pages'
// Content-Security-Policy (astro.config.mjs `security.csp.styleDirective.hashes`). Astro
// hashes what it renders; it cannot see a <style> element a bundled library appends later.
// Computed from the installed package on every build, so an upgrade cannot leave a stale
// hash behind; a library that changes how it injects fails the build here instead of
// failing in browsers. docs/guides/how-to-configure-security-headers.md#inline-scripts-and-styles
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const fromUi = createRequire(
  fileURLToPath(new URL("../../packages/ui/package.json", import.meta.url))
);

/** The CSS sonner (the toast component of packages/ui) passes to its `__insertCSS`. */
export function sonnerInjectedCss() {
  const source = readFileSync(
    fromUi.resolve("sonner").replace(/index\.js$/, "index.mjs"),
    "utf8"
  );
  const call = 'insertCSS("';
  const start = source.indexOf(call);
  if (start < 0 || source.indexOf(call, start + 1) >= 0) {
    throw new Error(
      "csp-hashes.mjs: sonner no longer injects exactly one stylesheet with __insertCSS; review its CSP hash"
    );
  }
  let end = start + call.length;
  while (source[end] !== '"' || source[end - 1] === "\\") end += 1;
  return JSON.parse(source.slice(start + call.length - 1, end + 1));
}

/** `sha256-…` of a style element's text, as CSP expects it (unquoted, for Astro). */
export function styleHash(css) {
  return `sha256-${createHash("sha256").update(css).digest("base64")}`;
}

/** Every runtime-injected style the pages need. */
export function injectedStyleHashes() {
  return [styleHash(sonnerInjectedCss())];
}
