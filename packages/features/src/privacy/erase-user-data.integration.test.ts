import { describe, expect, it, vi } from "vitest";
import { memoryAdminAuthGateway } from "../../test/memory-admin-auth-gateway";
import { privacyFixture } from "../../test/privacy-fixtures";
import { eraseUserData } from "./erase-user-data";

describe("eraseUserData", () => {
  it("refuses admin self-erasure before calling a gateway", async () => {
    const { deps, person } = await privacyFixture();
    const gateway = memoryAdminAuthGateway();
    await expect(
      eraseUserData(
        {
          ...deps,
          gateway,
          eraseUserArtifacts: vi.fn(),
          eraseWorkspaceArtifacts: vi.fn(),
        },
        { userId: person.id },
        { userId: person.id }
      )
    ).rejects.toMatchObject({ code: "CANNOT_ERASE_SELF_AS_ADMIN" });
  });
});
