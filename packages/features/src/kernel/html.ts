/**
 * An escaping `html` tagged template for email bodies: every interpolated value is escaped
 * unless it is itself the result of `html` (a `SafeHtml`), so user data (names, workspace
 * names) can never inject markup into a mail. Arrays are joined. In the kernel because the
 * domains that declare notifications (workspaces, accounts) may import only the kernel.
 */

/** Markup produced by `html`: trusted, inserted as it is. */
export class SafeHtml {
  readonly value: string;
  constructor(value: string) {
    this.value = value;
  }
  toString(): string {
    return this.value;
  }
}

/** Escapes text for an HTML element body or a quoted attribute value. */
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

type HtmlValue =
  | SafeHtml
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly HtmlValue[];

function render(value: HtmlValue): string {
  if (value === null || value === undefined || value === false) return "";
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(render).join("");
  return escapeHtml(String(value));
}

/** `html\`<p>${name} joined</p>\``: escapes `name`, keeps nested `html` results. */
export function html(
  strings: TemplateStringsArray,
  ...values: readonly HtmlValue[]
): SafeHtml {
  let out = strings[0] ?? "";
  values.forEach((value, index) => {
    out += render(value) + (strings[index + 1] ?? "");
  });
  return new SafeHtml(out);
}
