import { describe, expect, it } from "vitest";

import { LastOwnerError } from "./errors";
import {
  keepsAManager,
  type MemberRole,
  requireManagerRemains,
} from "./membership-rules";

const ada: MemberRole = { userId: "ada", role: "owner" };
const alan: MemberRole = { userId: "alan", role: "member" };
const grace: MemberRole = { userId: "grace", role: "owner" };

describe("membership rules", () => {
  it("refuses to remove, demote or let go the last owner", () => {
    const members = [ada, alan];
    expect(keepsAManager(members, { userId: "ada", nextRole: null })).toBe(
      false
    );
    expect(keepsAManager(members, { userId: "ada", nextRole: "member" })).toBe(
      false
    );
    expect(() =>
      requireManagerRemains(members, { userId: "ada", nextRole: null })
    ).toThrow(LastOwnerError);
  });

  it("allows it while another owner remains", () => {
    const members = [ada, alan, grace];
    expect(keepsAManager(members, { userId: "ada", nextRole: null })).toBe(
      true
    );
    expect(() =>
      requireManagerRemains(members, { userId: "ada", nextRole: "member" })
    ).not.toThrow();
  });

  it("does not care about members who cannot manage", () => {
    expect(keepsAManager([ada, alan], { userId: "alan", nextRole: null })).toBe(
      true
    );
  });

  it("counts a promotion as a new manager", () => {
    expect(
      keepsAManager([{ ...alan }], { userId: "alan", nextRole: "owner" })
    ).toBe(true);
  });

  it("refuses the last member leaving an otherwise empty workspace", () => {
    expect(keepsAManager([ada], { userId: "ada", nextRole: null })).toBe(false);
  });
});
