import { z } from "zod";

import { defineEvent } from "../../kernel";
import { ROLES } from "./permissions";

/** A workspace was created: a personal one at sign-up, or a shared one in multi mode. */
export const workspaceCreatedEvent = defineEvent(
  "workspaces.created",
  { strings: ["kind"], numbers: [] },
  z.object({ kind: z.enum(["personal", "shared"]) }).strict(),
  {
    client: false,
    description: "A workspace was created (personal at sign-up, or shared)",
  }
);

/** Someone became a member of an existing workspace. */
export const memberJoinedEvent = defineEvent(
  "workspaces.member_joined",
  { strings: ["role", "via"], numbers: [] },
  z
    .object({
      role: z.enum(ROLES),
      via: z.enum(["invitation", "sign_up"]),
    })
    .strict(),
  {
    client: false,
    description:
      "A user joined a workspace: by accepting an invitation, or at sign-up in single mode",
  }
);
