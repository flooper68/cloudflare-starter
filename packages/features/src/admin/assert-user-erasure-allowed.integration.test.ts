import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { seedUser, useCaseDeps } from "../../test/fixtures";
import { assertUserErasureAllowed } from "./assert-user-erasure-allowed";

describe("assertUserErasureAllowed", () => {
  it("refuses deleting the only active admin and ignores suspended admins", async () => {
    const a = await seedUser("Sole admin", "sole-erasure@example.test");
    await env.DB.prepare("UPDATE user SET role='admin' WHERE id=?")
      .bind(a.id)
      .run();
    await expect(
      assertUserErasureAllowed(useCaseDeps(), a.id)
    ).rejects.toMatchObject({ code: "LAST_ADMIN" });
    const b = await seedUser("Backup admin", "backup-erasure@example.test");
    await env.DB.prepare("UPDATE user SET role='admin',banned=1 WHERE id=?")
      .bind(b.id)
      .run();
    await expect(
      assertUserErasureAllowed(useCaseDeps(), a.id)
    ).rejects.toMatchObject({ code: "LAST_ADMIN" });
    await env.DB.prepare("UPDATE user SET banned=0 WHERE id=?")
      .bind(b.id)
      .run();
    await expect(
      assertUserErasureAllowed(useCaseDeps(), a.id)
    ).resolves.toBeUndefined();
  });
});
