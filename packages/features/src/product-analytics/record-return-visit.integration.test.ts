import { describe, expect, it } from "vitest";

import { seedUser, testRequestContext, useCaseDeps } from "../../test/fixtures";
import { recordReturnVisit } from "./record-return-visit";

describe("recordReturnVisit", () => {
  it("sends nothing on the sign-up day, then app.session_returned once with the days since", async () => {
    const ada = await seedUser("Ada Return");
    const context = { ...testRequestContext(), userId: ada.id };
    const signedUpAt = new Date("2026-10-28T08:00:00.000Z");

    const sameDay = useCaseDeps("2026-10-28T22:00:00.000Z");
    expect(await recordReturnVisit(sameDay, context, signedUpAt)).toBe(false);
    expect(sameDay.analytics.recorded).toEqual([]);

    const later = useCaseDeps("2026-10-31T09:00:00.000Z");
    expect(await recordReturnVisit(later, context, signedUpAt)).toBe(true);
    expect(await recordReturnVisit(later, context, signedUpAt)).toBe(false);
    expect(
      later.analytics.recorded.map((call) => [call.event, call.properties])
    ).toEqual([["app.session_returned", { days_since_sign_up: 3 }]]);
  });
});
