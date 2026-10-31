import { describe, expect, it } from "vitest";
import { rows, useCaseDeps } from "../../test/fixtures";
import { recordAccountDeletion } from "./record-account-deletion";

describe("recordAccountDeletion", () => {
  it("records an erased user without requiring a remaining account row", async () => {
    await recordAccountDeletion(useCaseDeps(), { userId: "erased-person" });
    expect(
      await rows("SELECT action, actor_user_id, target_id FROM audit_events")
    ).toEqual([
      {
        action: "user.deleted",
        actor_user_id: "erased-person",
        target_id: "erased-person",
      },
    ]);
  });
});
