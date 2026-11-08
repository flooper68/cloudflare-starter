import { describe, expect, it } from "vitest";

import {
  containerRunFinishedNotification,
  containerRunHref,
} from "./notification";

const runId = "0b6a3b57-6c3a-4a51-9c71-7a4b8b1f0c11";
const ctx = { appUrl: "https://starter.example" };

describe("container run finished notification", () => {
  it("is in the app by default and by email only when the person turns it on", () => {
    expect(containerRunFinishedNotification.defaultChannels).toEqual({
      inApp: true,
      email: false,
    });
    expect(containerRunFinishedNotification.securityCritical).toBe(false);
  });

  it("links to the run on the demo page", () => {
    const rendered = containerRunFinishedNotification.render(
      { runId, digits: 10_000, outcome: "succeeded" },
      ctx
    );
    expect(containerRunHref(runId)).toBe(`/app/container-demo?run=${runId}`);
    expect(rendered.inApp).toEqual({
      title: "Container run finished: 10,000 digits of pi",
      body: "The result is stored and ready to download for 7 days.",
      href: `/app/container-demo?run=${runId}`,
    });
    expect(rendered.email.html).toContain(
      `https://starter.example/app/container-demo?run=${runId}`
    );
  });

  it("says a failed run can be retried", () => {
    const rendered = containerRunFinishedNotification.render(
      { runId, digits: 1000, outcome: "failed" },
      ctx
    );
    expect(rendered.inApp.title).toBe(
      "Container run failed: 1,000 digits of pi"
    );
    expect(rendered.email.text).toContain("retry");
  });

  it("refuses data beyond the run, its digits and outcome", () => {
    expect(
      containerRunFinishedNotification.data.safeParse({
        runId,
        digits: 1000,
        outcome: "succeeded",
        pi: "3.14",
      }).success
    ).toBe(false);
  });
});
