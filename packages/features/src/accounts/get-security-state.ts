import { and, eq, gt } from "drizzle-orm";
import type { Database } from "../database";
import type { Clock } from "../kernel";
import * as authSchema from "./accounts.schema";
import { account, session, user } from "./accounts.schema";
import {
  type SecuritySettings,
  securityDecision,
} from "./domain/security-policy";

/** Safe security state. Session evidence must belong to this user and still be live. */
export async function getSecurityState(
  deps: { readonly db: Database; readonly clock: Clock },
  input: {
    readonly userId: string;
    readonly sessionId?: string | null;
    readonly settings: SecuritySettings;
  }
) {
  const { passkey } = authSchema;
  const [users, sessions, accounts, keys] = await deps.db.batch([
    deps.db
      .select({ role: user.role, enrolled: user.twoFactorEnabled })
      .from(user)
      .where(eq(user.id, input.userId))
      .limit(1),
    deps.db
      .select({ amr: session.amr, secondFactorAt: session.secondFactorAt })
      .from(session)
      .where(
        and(
          eq(session.id, input.sessionId ?? ""),
          eq(session.userId, input.userId),
          gt(session.expiresAt, deps.clock.now())
        )
      )
      .limit(1),
    deps.db
      .select({ provider: account.providerId })
      .from(account)
      .where(eq(account.userId, input.userId)),
    deps.db
      .select({
        id: passkey.id,
        name: passkey.name,
        createdAt: passkey.createdAt,
      })
      .from(passkey)
      .where(eq(passkey.userId, input.userId)),
  ]);
  const current = users[0];
  const evidence = sessions[0];
  const amr = evidence?.amr?.split(" ") ?? [];
  const verified =
    !!evidence?.secondFactorAt &&
    evidence.secondFactorAt.getTime() <= deps.clock.now().getTime() &&
    amr.some((value) => ["otp", "mfa"].includes(value));
  const enrolled = current?.enrolled === true;
  return {
    decision: securityDecision(input.settings, {
      role: current?.role ?? null,
      enrolled,
      verified,
    }),
    enrolled,
    required:
      input.settings.mode === "required" ||
      (input.settings.mode === "required-for-admins" &&
        current?.role
          ?.split(",")
          .map((role) => role.trim())
          .includes("admin")),
    verified,
    freshFactor: amr.includes("otp"),
    sessionValid: Boolean(evidence),
    secondFactorAt: evidence?.secondFactorAt?.toISOString() ?? null,
    hasPassword: accounts.some((row) => row.provider === "credential"),
    passkeys: keys.map((key) => ({
      ...key,
      createdAt: key.createdAt?.toISOString() ?? null,
    })),
    settings: input.settings,
  };
}
