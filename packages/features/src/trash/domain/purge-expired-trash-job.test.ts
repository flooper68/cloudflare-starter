import { describe, expect, it } from "vitest";

import { purgeExpiredTrashJob } from "./purge-expired-trash-job";

describe("purgeExpiredTrashJob", () => {
  it("is the trash feature's job, without an idempotency key: reruns purge nothing new", () => {
    expect(purgeExpiredTrashJob.type).toBe("trash.purge-expired");
    expect(purgeExpiredTrashJob.idempotencyKey).toBeUndefined();
  });

  it("takes the cron run's time as an ISO instant, nothing else", () => {
    const payload = purgeExpiredTrashJob.payload;
    expect(payload.safeParse({ asOf: "2026-10-28T03:17:00.000Z" })).toEqual({
      success: true,
      data: { asOf: "2026-10-28T03:17:00.000Z" },
    });
    expect(payload.safeParse({}).success).toBe(false);
    expect(payload.safeParse({ asOf: "yesterday" }).success).toBe(false);
    expect(
      payload.safeParse({ asOf: "2026-10-28T03:17:00.000Z", workspaceId: "x" })
        .success
    ).toBe(false);
  });
});
