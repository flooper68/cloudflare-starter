import { describe, expect, it } from "vitest";

import { adminDeps, seedAccount, userAudit } from "../../test/admin-fixtures";
import {
  AdminUserNotFoundError,
  PasswordResetUnavailableError,
} from "./domain";
import { sendPasswordReset } from "./send-password-reset";

describe("sendPasswordReset", () => {
  it("sends the reset mail through the gateway and records it", async () => {
    const admin = await seedAccount("Ada Admin", { role: "admin" });
    const grace = await seedAccount("Grace Hopper");
    const deps = adminDeps();

    expect(
      await sendPasswordReset(
        deps,
        { userId: admin.id },
        {
          userId: grace.id,
          redirectTo: "/reset-password",
        }
      )
    ).toEqual({ userId: grace.id, email: grace.email });
    expect(deps.gateway.calls).toEqual([
      {
        op: "sendPasswordReset",
        email: grace.email,
        redirectTo: "/reset-password",
      },
    ]);
    expect(await userAudit(grace.id)).toMatchObject([
      { action: "user.password_reset_sent", actor: admin.id },
    ]);
  });

  it("records nothing when the mail cannot go out or the user is unknown", async () => {
    const admin = await seedAccount("Ada Admin1", { role: "admin" });
    const alan = await seedAccount("Alan Turing1");
    const deps = adminDeps({
      failPasswordReset: new PasswordResetUnavailableError("Email is off"),
    });
    await expect(
      sendPasswordReset(
        deps,
        { userId: admin.id },
        {
          userId: alan.id,
          redirectTo: "/reset-password",
        }
      )
    ).rejects.toThrow(PasswordResetUnavailableError);
    expect(await userAudit(alan.id)).toEqual([]);
    await expect(
      sendPasswordReset(
        deps,
        { userId: admin.id },
        {
          userId: "user-nobody",
          redirectTo: "/reset-password",
        }
      )
    ).rejects.toThrow(AdminUserNotFoundError);
  });
});
