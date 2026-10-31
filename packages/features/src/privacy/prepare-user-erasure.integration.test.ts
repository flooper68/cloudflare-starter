import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import {
  addMember,
  seedUser,
  seedWorkspace,
  storeTestFile,
} from "../../test/fixtures";
import { privacyFixture } from "../../test/privacy-fixtures";
import { completeUserErasure } from "./complete-user-erasure";
import { prepareUserErasure } from "./prepare-user-erasure";
import { erasureLock } from "./privacy.schema";

describe("prepareUserErasure", () => {
  it("refuses a sole platform admin before any user storage/workspace cleanup", async () => {
    const { deps, person, actor } = await privacyFixture();
    await env.DB.prepare("UPDATE user SET role='admin' WHERE id=?")
      .bind(person.id)
      .run();
    const file = await storeTestFile(actor);
    const eraseUserArtifacts = vi.fn();
    const eraseWorkspaceArtifacts = vi.fn();
    await expect(
      prepareUserErasure(
        { ...deps, eraseUserArtifacts, eraseWorkspaceArtifacts },
        { userId: person.id }
      )
    ).rejects.toMatchObject({ code: "LAST_ADMIN" });
    expect(eraseUserArtifacts).not.toHaveBeenCalled();
    expect(eraseWorkspaceArtifacts).not.toHaveBeenCalled();
    expect(await env.FILES.head(file.r2Key)).not.toBeNull();
  });
  it("refuses a last shared-workspace owner before erasing even their personal files", async () => {
    const { deps, person, actor } = await privacyFixture();
    const shared = await seedWorkspace(person.id, {
      id: "privacy-shared",
      kind: "shared",
    });
    const member = await seedUser(
      "Shared member",
      "privacy-shared-member@example.test"
    );
    await addMember(shared.workspaceId, member.id);
    const file = await storeTestFile(actor);
    const eraseUserArtifacts = vi.fn();
    const eraseWorkspaceArtifacts = vi.fn();
    await expect(
      prepareUserErasure(
        { ...deps, eraseUserArtifacts, eraseWorkspaceArtifacts },
        { userId: person.id }
      )
    ).rejects.toMatchObject({ kind: "conflict" });
    expect(eraseWorkspaceArtifacts).not.toHaveBeenCalled();
    expect(await env.FILES.head(file.r2Key)).not.toBeNull();
  });
  it("a separate same-subject invocation cannot steal or release the active lease", async () => {
    const { deps, person } = await privacyFixture();
    const second = await seedUser(
      "Concurrent admin",
      "concurrent-erasure-admin@example.test"
    );
    await env.DB.prepare("UPDATE user SET role='admin' WHERE id IN (?,?)")
      .bind(person.id, second.id)
      .run();
    let entered!: () => void;
    let resume!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      resume = resolve;
    });
    const first = prepareUserErasure(
      {
        ...deps,
        eraseWorkspaceArtifacts: async () => {},
        eraseUserArtifacts: async () => {
          entered();
          await gate;
        },
      },
      { userId: person.id, operationId: "operation-A" }
    );
    await started;
    const secondCleanup = vi
      .fn()
      .mockRejectedValue(new Error("must never run"));
    await expect(
      prepareUserErasure(
        {
          ...deps,
          eraseWorkspaceArtifacts: async () => {},
          eraseUserArtifacts: secondCleanup,
        },
        { userId: person.id, operationId: "separate-A" }
      )
    ).rejects.toMatchObject({ code: "ERASURE_BUSY" });
    expect(secondCleanup).not.toHaveBeenCalled();
    await expect(
      prepareUserErasure(
        {
          ...deps,
          eraseWorkspaceArtifacts: async () => {},
          eraseUserArtifacts: async () => {},
        },
        { userId: second.id, operationId: "operation-B" }
      )
    ).rejects.toMatchObject({ code: "ERASURE_BUSY" });
    await completeUserErasure(deps, {
      userId: person.id,
      email: person.email,
      operationId: "separate-A",
    });
    expect(
      (
        await deps.db
          .select()
          .from(erasureLock)
          .where(eq(erasureLock.id, "global"))
      )[0]?.operationId
    ).toBe("operation-A");
    resume();
    await first;
    await completeUserErasure(deps, {
      userId: person.id,
      email: person.email,
      operationId: "operation-A",
    });
    expect(await deps.db.select().from(erasureLock)).toHaveLength(0);
  });
});
