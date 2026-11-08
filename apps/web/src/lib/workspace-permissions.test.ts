import { ROLES, rolesAllowedTo } from "@cloudflare-starter/features";
import { describe, expect, it } from "vitest";

import {
  CLIENT_ACTIONS,
  type ClientAction,
  clientCan,
} from "./workspace-permissions";

describe("the browser's copy of the permission map", () => {
  it("allows exactly the roles the server allows", () => {
    for (const action of Object.keys(CLIENT_ACTIONS) as ClientAction[]) {
      expect([...CLIENT_ACTIONS[action]].sort(), action).toEqual(
        [...rolesAllowedTo(action)].sort()
      );
    }
  });

  it("answers per role, and nothing without a workspace role", () => {
    for (const role of ROLES) {
      expect(clientCan(role, "notes.read")).toBe(true);
    }
    expect(clientCan("owner", "workspace.manage")).toBe(true);
    expect(clientCan("member", "workspace.manage")).toBe(false);
    expect(clientCan("member", "invitations.manage")).toBe(false);
    expect(clientCan(undefined, "notes.read")).toBe(false);
    expect(clientCan("guest", "notes.read")).toBe(false);
  });
});
