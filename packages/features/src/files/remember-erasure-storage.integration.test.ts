import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { memoryAdminAuthGateway } from "../../test/memory-admin-auth-gateway";
import { privacyFixture } from "../../test/privacy-fixtures";
import { buildErasureHandlers } from "../erasure-catalog";
import { completeUserErasure, prepareUserErasure } from "../privacy";
import { pendingFileCleanup } from "./files.schema";
import { rememberErasureStorage } from "./remember-erasure-storage";

describe("rememberErasureStorage", () => {
  it("survives auth partial failure and refreshes the old workspace target on successful retry", async () => {
    const { deps, person, actor } = await privacyFixture();
    await rememberErasureStorage(deps, {
      userId: person.id,
      workspaceIds: [actor.workspaceId],
    });
    await prepareUserErasure(
      { ...deps, ...buildErasureHandlers(deps) },
      { userId: person.id, operationId: "first" }
    );
    // The auth adapter fails here, leaving the user but no personal workspace; a later retry has no workspace IDs to rediscover.
    const later = {
      ...deps,
      clock: { now: () => new Date(deps.clock.now().getTime() + 1800000) },
    };
    await prepareUserErasure(
      { ...later, ...buildErasureHandlers(later) },
      { userId: person.id, operationId: "retry" }
    );
    await memoryAdminAuthGateway().deleteUser(person.id);
    await completeUserErasure(later, {
      userId: person.id,
      email: person.email,
      operationId: "retry",
    });
    const [intent] = await deps.db
      .select()
      .from(pendingFileCleanup)
      .where(eq(pendingFileCleanup.target, `workspaces/${actor.workspaceId}/`));
    expect(intent?.workspaceId).toBe(actor.workspaceId);
    expect(intent?.notBefore.getTime()).toBe(
      later.clock.now().getTime() + 3600000
    );
  });
});
