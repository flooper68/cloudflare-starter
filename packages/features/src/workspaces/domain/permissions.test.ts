import { describe, expect, it } from "vitest";

import { ActionNotAllowedError } from "./errors";
import {
  ACTIONS,
  type Action,
  CREATOR_ROLE,
  can,
  DEFAULT_MEMBER_ROLE,
  isRole,
  ROLES,
  requirePermission,
  rolesAllowedTo,
} from "./permissions";

describe("permissions", () => {
  it("lets owners do everything and members read and work with files", () => {
    for (const action of Object.keys(ACTIONS) as Action[]) {
      expect(can("owner", action)).toBe(true);
    }
    expect(can("member", "files.read")).toBe(true);
    expect(can("member", "files.write")).toBe(true);
    expect(can("member", "members.read")).toBe(true);
    expect(can("member", "members.manage")).toBe(false);
    expect(can("member", "invitations.manage")).toBe(false);
    expect(can("member", "invitations.read")).toBe(false);
    expect(can("member", "ownership.transfer")).toBe(false);
    expect(can("member", "billing.read")).toBe(true);
    expect(can("member", "billing.manage")).toBe(false);
  });

  it("keeps someone able to manage members: the creator's role can, and transfer ownership", () => {
    expect(ACTIONS["members.manage"].length).toBeGreaterThan(0);
    expect(can(CREATOR_ROLE, "members.manage")).toBe(true);
    expect(can(CREATOR_ROLE, "ownership.transfer")).toBe(true);
  });

  it("only names known roles in the map", () => {
    expect(ROLES).toContain(DEFAULT_MEMBER_ROLE);
    for (const roles of Object.values(ACTIONS)) {
      for (const role of roles) expect(isRole(role)).toBe(true);
    }
  });

  it("lists the roles allowed to perform an action", () => {
    expect(rolesAllowedTo("members.manage")).toEqual(["owner"]);
    expect(rolesAllowedTo("files.read")).toEqual(["owner", "member"]);
  });

  it("recognises roles and rejects anything else", () => {
    expect(isRole("owner")).toBe(true);
    expect(isRole("member")).toBe(true);
    expect(isRole("admin")).toBe(false);
    expect(isRole("")).toBe(false);
  });

  it("requirePermission throws for a role without the action", () => {
    expect(() =>
      requirePermission({ role: "owner" }, "members.manage")
    ).not.toThrow();
    expect(() =>
      requirePermission({ role: "member" }, "members.manage")
    ).toThrow(ActionNotAllowedError);
  });
});

it("only owners manage workspace settings and deletion", () => {
  for (const action of ["workspace.manage", "workspace.delete"] as const) {
    expect(can("owner", action)).toBe(true);
    expect(can("member", action)).toBe(false);
  }
});
