import { describe, expect, it } from "vitest";

import { containerRunStartedEvent } from "./analytics-events";
import { startContainerRunInputSchema } from "./run-input";
import { newRunSteps } from "./run-steps";
import {
  CONTAINER_RUN_RESULT_KEY,
  containerRunDownloadHref,
  containerRunExpiry,
  containerRunResultKey,
  resultPreview,
  toContainerRunSummary,
  utcDay,
} from "./run-summary";

const now = new Date("2026-11-08T23:59:59.000Z");
const row = {
  id: "0b6a3b57-6c3a-4a51-9c71-7a4b8b1f0c11",
  workspaceId: "ws-1",
  createdBy: "user-1",
  createdByName: "Ada",
  digits: 1000,
  status: "queued",
  steps: JSON.stringify(newRunSteps(now)),
  errorCode: null,
  retryOf: null,
  resultKey: null,
  resultPreview: null,
  resultBytes: null,
  computeMs: null,
  createdAt: now,
  finishedAt: null,
  expiresAt: containerRunExpiry(now),
};

describe("container run summary", () => {
  it("keeps results under the workspace's prefix, matched by the reconciliation pattern", () => {
    const key = containerRunResultKey("ws-1", row.id);
    expect(key).toBe(`workspaces/ws-1/container-runs/${row.id}.txt`);
    expect(CONTAINER_RUN_RESULT_KEY.test(key)).toBe(true);
    expect(
      CONTAINER_RUN_RESULT_KEY.test("workspaces/ws-1/uploads/2026/11/x")
    ).toBe(false);
  });

  it("counts the daily cap per UTC day and expires runs after 7 days", () => {
    expect(utcDay(now)).toBe("2026-11-08");
    expect(utcDay(new Date("2026-11-09T00:00:00.000Z"))).toBe("2026-11-09");
    expect(containerRunExpiry(now).toISOString()).toBe(
      "2026-11-15T23:59:59.000Z"
    );
  });

  it("previews the first 100 decimals", () => {
    const pi = `3.${"1".repeat(500)}`;
    expect(resultPreview(pi)).toBe(`3.${"1".repeat(100)}`);
    expect(resultPreview("3.14")).toBe("3.14");
  });

  it("is a queued run without a result until the workflow stores one", () => {
    const summary = toContainerRunSummary(row);
    expect(summary).toMatchObject({
      id: row.id,
      digits: 1000,
      status: "queued",
      startedBy: { id: "user-1", name: "Ada" },
      durationMs: null,
      result: null,
      expiresAt: "2026-11-15T23:59:59.000Z",
    });
    expect(summary.steps).toHaveLength(6);
  });

  it("links the stored result to its download route", () => {
    const summary = toContainerRunSummary({
      ...row,
      resultKey: containerRunResultKey("ws-1", row.id),
      resultPreview: "3.14",
      resultBytes: 1003,
    });
    expect(summary.result).toEqual({
      preview: "3.14",
      bytes: 1003,
      downloadHref: containerRunDownloadHref("ws-1", row.id),
    });
    expect(summary.result?.downloadHref).toBe(
      `/api/container-runs/${row.id}/result?workspaceId=ws-1`
    );
  });

  it("names nobody once the starter's account is gone", () => {
    expect(
      toContainerRunSummary({ ...row, createdBy: null, createdByName: null })
        .startedBy
    ).toBeNull();
  });
});

describe("container run input", () => {
  it("takes a preset or a run to retry, never both or neither", () => {
    expect(startContainerRunInputSchema.parse({ digits: 10_000 })).toEqual({
      digits: 10_000,
    });
    expect(startContainerRunInputSchema.parse({ retryOf: row.id })).toEqual({
      retryOf: row.id,
    });
    for (const input of [
      {},
      { digits: 12_345 },
      { digits: 1000, retryOf: row.id },
      { retryOf: "not-a-uuid" },
    ]) {
      expect(startContainerRunInputSchema.safeParse(input).success).toBe(false);
    }
  });

  it("tracks the preset and kind, never more", () => {
    expect(
      containerRunStartedEvent.properties.safeParse({
        digits: "1000",
        kind: "new",
      }).success
    ).toBe(true);
    expect(
      containerRunStartedEvent.properties.safeParse({
        digits: "1000",
        kind: "new",
        userEmail: "a@example.com",
      }).success
    ).toBe(false);
  });
});
