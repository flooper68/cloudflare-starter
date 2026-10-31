import { env as workerEnv } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { getAuth } from "@/server/auth";
import type { AppEnv } from "@/server/env";
import { APP_URL, signUp } from "./helpers";

const env = workerEnv as AppEnv;
async function erase(cookie: string) {
  return getAuth(env).handler(
    new Request(`${APP_URL}/api/auth/delete-user`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: APP_URL, cookie },
      body: JSON.stringify({ password: "test-password-1234" }),
    })
  );
}
describe("real Better Auth erasure preflight", () => {
  it("sole active admin self-delete is refused with files, workspace, account and session intact; another admin permits it", async () => {
    const admin = await signUp(
      "Sole privacy admin",
      "sole-privacy-admin@example.test"
    );
    await env.DB.prepare("UPDATE user SET role='admin' WHERE id=?")
      .bind(admin.id)
      .run();
    const key = `users/${admin.id}/avatar/test`;
    await env.FILES.put(key, "avatar");
    const denied = await erase(admin.cookie);
    expect(denied.ok).toBe(false);
    expect(await denied.text()).toContain("LAST_ADMIN");
    expect(await env.FILES.head(key)).not.toBeNull();
    expect(
      (
        await env.DB.prepare("SELECT id FROM user WHERE id=?")
          .bind(admin.id)
          .all()
      ).results
    ).toHaveLength(1);
    expect(
      (
        await env.DB.prepare("SELECT id FROM session WHERE user_id=?")
          .bind(admin.id)
          .all()
      ).results.length
    ).toBeGreaterThan(0);
    expect(
      (
        await env.DB.prepare("SELECT id FROM workspaces WHERE created_by=?")
          .bind(admin.id)
          .all()
      ).results.length
    ).toBeGreaterThan(0);
    const second = await signUp(
      "Backup privacy admin",
      "backup-privacy-admin@example.test"
    );
    await env.DB.prepare("UPDATE user SET role='admin' WHERE id=?")
      .bind(second.id)
      .run();
    const allowed = await erase(admin.cookie);
    expect(allowed.ok).toBe(true);
    expect(await env.FILES.head(key)).toBeNull();
    expect(
      (
        await env.DB.prepare("SELECT id FROM user WHERE id=?")
          .bind(admin.id)
          .all()
      ).results
    ).toHaveLength(0);
    expect(
      (
        await env.DB.prepare(
          "SELECT completed_at FROM erasure_records WHERE user_id=?"
        )
          .bind(admin.id)
          .first()
      )?.completed_at
    ).not.toBeNull();
  });
});
