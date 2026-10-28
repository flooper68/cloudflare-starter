import { z } from "zod";

import { defineNotification, html } from "../../kernel";

const name = z.string().min(1).max(200);
const role = z.string().min(1).max(64);

/** "Owner" for "owner": roles as people read them. */
function roleLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Sent to the members who can manage members when someone accepts an invitation. */
export const memberJoinedNotification = defineNotification({
  type: "workspaces.member-joined",
  label: "Someone joins a workspace you manage",
  data: z
    .object({
      workspaceId: z.string().min(1).max(100),
      workspaceName: name,
      memberName: name,
      role,
    })
    .strict(),
  defaultChannels: { inApp: true, email: true },
  securityCritical: false,
  render: (data, { appUrl }) => {
    const title = `${data.memberName} joined ${data.workspaceName}`;
    const body = `${data.memberName} accepted your invitation and joined as ${roleLabel(data.role)}.`;
    return {
      inApp: { title, body, href: "/app/members" },
      email: {
        subject: title,
        text: `${body}\n\nSee the members: ${appUrl}/app/members`,
        html: html`<p><strong>${data.memberName}</strong> accepted your invitation and joined <strong>${data.workspaceName}</strong> as ${roleLabel(data.role)}.</p><p><a href="${appUrl}/app/members">See the members</a></p>`
          .value,
      },
    };
  },
});

/** Sent to a member whose role changed (a role change, or becoming owner by a transfer). */
export const roleChangedNotification = defineNotification({
  type: "workspaces.role-changed",
  label: "Your role in a workspace changes",
  data: z
    .object({
      workspaceId: z.string().min(1).max(100),
      workspaceName: name,
      role,
      previousRole: role,
    })
    .strict(),
  defaultChannels: { inApp: true, email: true },
  securityCritical: false,
  render: (data, { appUrl }) => {
    const title = `You are now ${roleLabel(data.role)} in ${data.workspaceName}`;
    const body = `Your role in ${data.workspaceName} changed from ${roleLabel(data.previousRole)} to ${roleLabel(data.role)}.`;
    return {
      inApp: { title, body, href: "/app/members" },
      email: {
        subject: title,
        text: `${body}\n\nOpen the workspace: ${appUrl}/app/members`,
        html: html`<p>Your role in <strong>${data.workspaceName}</strong> changed from ${roleLabel(data.previousRole)} to <strong>${roleLabel(data.role)}</strong>.</p><p><a href="${appUrl}/app/members">Open the workspace</a></p>`
          .value,
      },
    };
  },
});
