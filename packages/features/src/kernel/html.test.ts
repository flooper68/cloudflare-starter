import { describe, expect, it } from "vitest";

import { escapeHtml, html, SafeHtml } from "./html";

describe("html", () => {
  it("escapes interpolated text", () => {
    const name = `<img src=x onerror="alert('x')">`;
    expect(html`<p>${name} joined</p>`.value).toBe(
      "<p>&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt; joined</p>"
    );
  });

  it("keeps nested html and joins arrays", () => {
    const items = ["A & B", "C"].map((item) => html`<li>${item}</li>`);
    expect(html`<ul>${items}</ul>`.value).toBe(
      "<ul><li>A &amp; B</li><li>C</li></ul>"
    );
  });

  it("drops null, undefined and false; prints numbers", () => {
    expect(html`${null}${undefined}${false}${3}`.value).toBe("3");
  });

  it("returns SafeHtml that stringifies to its markup", () => {
    const safe = html`<b>${"x"}</b>`;
    expect(safe).toBeInstanceOf(SafeHtml);
    expect(String(safe)).toBe("<b>x</b>");
  });

  it("escapeHtml escapes the five special characters", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });
});
