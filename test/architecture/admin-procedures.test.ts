/**
 * The admin portal is closed to everyone but platform admins (docs/guides/how-to-use-admin-portal.md):
 * every `admin.*` procedure runs the `requireAdmin` gate (adminProcedure: role admin and
 * ADMIN_PORTAL=on, else NOT_FOUND), and no procedure outside `admin.*` does. The one
 * exception is stopping an impersonation, called from the impersonated session and gated
 * by `requireImpersonator` instead.
 */
import { describe, expect, it } from "vitest";

import { PROCEDURE_PATHS } from "@/server/mcp/tools";
import {
  adminDestructiveProcedure,
  requireAdmin,
  requireImpersonator,
} from "@/server/trpc/init";
import { appRouter } from "@/server/trpc/router";

/** `admin.*` procedures gated by requireImpersonator instead, with the reason. */
const IMPERSONATOR_PROCEDURES: Readonly<Record<string, string>> = {
  "admin.impersonation.stop":
    "called by the impersonated session, whose user is not an admin",
};

/** Procedures that must also require a recent sign-in (adminDestructiveProcedure). */
const DESTRUCTIVE = [
  "admin.users.ban",
  "admin.users.revokeSessions",
  "admin.users.setRole",
  "admin.users.remove",
  "admin.workspaces.assignOwner",
  "admin.workspaces.delete",
];

type Procedure = { _def: { middlewares: unknown[] } };
const procedures = appRouter._def.procedures as unknown as Record<
  string,
  Procedure
>;

/** The middleware functions a builder (t.middleware(...) or a procedure) contributes. */
function middlewaresOf(builder: unknown): unknown[] {
  const value = builder as {
    _middlewares?: unknown[];
    _def?: { middlewares: unknown[] };
  };
  return value._middlewares ?? value._def?.middlewares ?? [];
}

function runs(path: string, builder: unknown): boolean {
  const own = procedures[path]?._def.middlewares ?? [];
  return middlewaresOf(builder).every((fn) => own.includes(fn));
}

const adminPaths = PROCEDURE_PATHS.filter((path) => path.startsWith("admin."));

describe("admin procedures", () => {
  it("finds them", () => {
    expect(adminPaths.length).toBeGreaterThan(0);
    expect(middlewaresOf(requireAdmin).length).toBeGreaterThan(0);
  });

  it.each(adminPaths.filter((path) => !(path in IMPERSONATOR_PROCEDURES)))(
    "%s derives from adminProcedure",
    (path) => {
      expect(
        runs(path, requireAdmin),
        "build it on adminProcedure (apps/web/src/server/trpc/init.ts)"
      ).toBe(true);
    }
  );

  it.each(Object.keys(IMPERSONATOR_PROCEDURES))(
    "%s derives from impersonatorProcedure",
    (path) => {
      expect(adminPaths).toContain(path);
      expect(runs(path, requireImpersonator)).toBe(true);
    }
  );

  it.each(DESTRUCTIVE)("%s requires a recent sign-in", (path) => {
    expect(adminPaths).toContain(path);
    expect(runs(path, adminDestructiveProcedure)).toBe(true);
  });

  it("no procedure outside admin.* runs the admin gate", () => {
    const outside = PROCEDURE_PATHS.filter(
      (path) => !path.startsWith("admin.") && runs(path, requireAdmin)
    );
    expect(outside).toEqual([]);
  });
});
