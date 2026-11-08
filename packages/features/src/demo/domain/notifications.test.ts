import { describe, expect, it } from "vitest";
import {
  enforceDemoRetentionJob,
  seedDemoWorkspaceJob,
  warnDemoAccountJob,
} from "./jobs";
import { demoDeletionWarningNotification } from "./notifications";
import { DEMO_SAMPLE_NOTES, SAMPLE_PREFIX } from "./sample-data";
import { demoNoticeText, STARTER_REPOSITORY_URL } from "./settings";

describe("demo deletion warning", () => {
  const rendered = demoDeletionWarningNotification.render(
    { deletesAt: "2026-11-09T03:17:00.000Z" },
    { appUrl: "https://starter.flooper.me" }
  );

  it("is security-critical, so it is always emailed", () => {
    expect(demoDeletionWarningNotification.securityCritical).toBe(true);
    expect(demoDeletionWarningNotification.type).toBe("demo.deletion-warning");
  });

  it("says tomorrow and links the privacy export and the starter on GitHub", () => {
    expect(rendered.email.subject).toBe(
      "Your demo account will be deleted tomorrow"
    );
    for (const body of [rendered.email.text, rendered.email.html]) {
      expect(body).toContain("https://starter.flooper.me/app/settings/privacy");
      expect(body).toContain(STARTER_REPOSITORY_URL);
      expect(body).toContain("2026-11-09 03:17 UTC");
    }
    expect(rendered.inApp.href).toBe("/app/settings/privacy");
  });

  it("refuses data other than an ISO time", () => {
    expect(
      demoDeletionWarningNotification.data.safeParse({ deletesAt: "tomorrow" })
        .success
    ).toBe(false);
  });
});

describe("demo sample data and notice", () => {
  it("marks every sample note as a sample in its title and body", () => {
    expect(DEMO_SAMPLE_NOTES.length).toBeGreaterThanOrEqual(3);
    for (const note of DEMO_SAMPLE_NOTES) {
      expect(note.title.startsWith(SAMPLE_PREFIX)).toBe(true);
      expect(note.body).toMatch(/sample note/i);
    }
    expect(
      DEMO_SAMPLE_NOTES.filter((note) => note.comments.length > 0)
    ).toHaveLength(1);
  });

  it("names the retention", () => {
    expect(demoNoticeText(7)).toBe(
      "Demo instance: your account and data are deleted after 7 days."
    );
  });
});

describe("demo jobs", () => {
  it("are keyed so a duplicate is skipped", () => {
    expect(
      seedDemoWorkspaceJob.idempotencyKey?.({ userId: "u", workspaceId: "w" })
    ).toBe("w");
    expect(
      warnDemoAccountJob.idempotencyKey?.({
        userId: "u",
        asOf: "2026-11-08T03:17:00.000Z",
      })
    ).toBe("u");
    expect(
      enforceDemoRetentionJob.idempotencyKey?.({
        asOf: "2026-11-08T03:17:00.000Z",
        batch: 2,
      })
    ).toBe("2026-11-08T03:17:00.000Z:2");
  });
});
