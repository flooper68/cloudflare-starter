import { describe, expect, it } from "vitest";
import {
  cleanupStorageJob,
  PRESIGNED_UPLOAD_CLEANUP_DELAY_SECONDS,
  retryFileCleanupsJob,
} from "./cleanup-jobs";

describe("files.cleanup-storage and files.retry-cleanup", () => {
  it("validate targets and preserve the one-hour signing window", () => {
    expect(cleanupStorageJob.type).toBe("files.cleanup-storage");
    expect(retryFileCleanupsJob.type).toBe("files.retry-cleanup");
    expect(
      cleanupStorageJob.payload.safeParse({
        target: "workspaces/old/uploads/one",
      }).success
    ).toBe(true);
    expect(cleanupStorageJob.payload.safeParse({ target: "" }).success).toBe(
      false
    );
    expect(
      retryFileCleanupsJob.payload.safeParse({ cursor: "old" }).success
    ).toBe(true);
    expect(PRESIGNED_UPLOAD_CLEANUP_DELAY_SECONDS).toBe(3600);
  });
});
