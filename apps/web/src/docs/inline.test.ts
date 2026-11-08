import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { plainText, renderInline, tokenize } from "./inline";

describe("tokenize", () => {
  it("splits code, bold and links from text", () => {
    expect(
      tokenize(
        "**Sign-in.** Set `AUTH_EMAIL_PASSWORD`, see [the guide](docs/a.md)."
      )
    ).toEqual([
      { kind: "strong", children: [{ kind: "text", text: "Sign-in." }] },
      { kind: "text", text: " Set " },
      { kind: "code", text: "AUTH_EMAIL_PASSWORD" },
      { kind: "text", text: ", see " },
      {
        kind: "link",
        href: "docs/a.md",
        children: [{ kind: "text", text: "the guide" }],
      },
      { kind: "text", text: "." },
    ]);
  });

  it("gives the plain text", () => {
    expect(plainText(tokenize("**A** `b` [c](d)"))).toBe("A b c");
  });
});

describe("renderInline", () => {
  it("renders elements, escapes text and rewrites repository links", () => {
    expect(
      renderToStaticMarkup(
        renderInline(
          "<b>raw</b> `x<y` [guide](docs/guides/how-to-setup-d1.md#deploy-order)",
          "CHANGELOG.md"
        )
      )
    ).toBe(
      '&lt;b&gt;raw&lt;/b&gt; <code>x&lt;y</code> <a href="/docs/guides/how-to-setup-d1/#deploy-order">guide</a>'
    );
  });
});
