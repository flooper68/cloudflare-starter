/**
 * The scripted QA checklist (docs/guides/how-to-qa-a-deployment.md) covers every
 * user-facing feature: each guide in docs/guides/ is linked from it, or exempt here with
 * the reason it describes no feature a person can try on a deployment.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { filesUnder, ROOT, read } from "./repo";

const CHECKLIST = "docs/guides/how-to-qa-a-deployment.md";

/** Guides with no user-facing feature of their own, and why. */
const EXEMPT: Readonly<Record<string, string>> = {
  "how-to-qa-a-deployment.md": "the checklist itself",
  "how-to-setup-web-app.md": "first-time local setup and deploy steps",
  "how-to-setup-ci.md":
    "CI and the deploy workflow, which runs the smoke suite",
  "how-to-setup-logging.md":
    "operations: log sinks; nothing a person sees in the app",
  "how-to-setup-error-reporting.md":
    "operations: error reports; the reference id shows in any error state",
  "how-to-setup-metrics-and-tracing.md":
    "operations: metrics and spans in Analytics Engine",
  "how-to-setup-product-analytics.md":
    "write-only analytics events; nothing visible in the app",
  "how-to-setup-container.md":
    "the Container demo is its own Worker, deployed separately",
  "how-to-use-storybook.md":
    "development tool; the checklist opens /_storybook/ under Landing",
};

const guides = filesUnder("docs/guides", /\.md$/).map(
  (path) => path.split("/").pop() as string
);
const checklist = read(CHECKLIST);
const linked = new Set(
  [...checklist.matchAll(/\]\(([\w.-]+\.md)(?:#[\w-]+)?\)/g)].map(
    (match) => match[1] as string
  )
);

describe("QA checklist", () => {
  it("finds the guides (the checks below are not vacuous)", () => {
    expect(guides.length).toBeGreaterThan(10);
    expect(linked.size).toBeGreaterThan(10);
  });

  it.each(guides.filter((guide) => !(guide in EXEMPT)))(
    "links %s, a user-facing feature guide",
    (guide) => {
      expect(
        linked.has(guide),
        `${guide} describes a user-facing feature: add a section to ${CHECKLIST} that links it, or exempt it with a reason`
      ).toBe(true);
    }
  );

  it("exempts only guides that exist and are not linked anyway", () => {
    for (const guide of Object.keys(EXEMPT)) {
      expect(guides, `${guide} is exempt but missing`).toContain(guide);
      if (guide !== "how-to-qa-a-deployment.md") {
        expect(
          linked.has(guide),
          `${guide} is linked: drop its exemption`
        ).toBe(false);
      }
    }
  });

  it("links only guides that exist", () => {
    for (const guide of linked) {
      expect(existsSync(join(ROOT, "docs/guides", guide)), guide).toBe(true);
    }
  });
});
