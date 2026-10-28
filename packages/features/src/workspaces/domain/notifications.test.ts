import { describe, expect, it } from "vitest";

import {
  memberJoinedNotification,
  roleChangedNotification,
} from "./notifications";

const context = { appUrl: "https://app.example.test" };

describe("workspace notifications", () => {
  it("member-joined renders in-app and email, escaping user data in HTML", () => {
    const data = memberJoinedNotification.data.safeParse({
      workspaceId: "ws-acme",
      workspaceName: "Acme <Robotics>",
      memberName: '<img src=x onerror="alert(1)">',
      role: "member",
    });
    expect(data.success).toBe(true);
    if (!data.success) return;
    const rendered = memberJoinedNotification.render(data.data, context);
    expect(rendered.inApp).toEqual({
      title: '<img src=x onerror="alert(1)"> joined Acme <Robotics>',
      body: '<img src=x onerror="alert(1)"> accepted your invitation and joined as Member.',
      href: "/app/members",
    });
    expect(rendered.email.html).toContain("Acme &lt;Robotics&gt;");
    expect(rendered.email.html).not.toContain("<img");
    expect(rendered.email.text).toContain(
      "https://app.example.test/app/members"
    );
    expect(memberJoinedNotification.securityCritical).toBe(false);
  });

  it("role-changed names the old and new role", () => {
    const rendered = roleChangedNotification.render(
      {
        workspaceId: "ws-acme",
        workspaceName: "Acme",
        role: "owner",
        previousRole: "member",
      },
      context
    );
    expect(rendered.inApp.title).toBe("You are now Owner in Acme");
    expect(rendered.email.subject).toBe("You are now Owner in Acme");
    expect(rendered.inApp.body).toBe(
      "Your role in Acme changed from Member to Owner."
    );
  });

  it("refuses data the schema does not declare", () => {
    expect(
      roleChangedNotification.data.safeParse({
        workspaceId: "ws-acme",
        workspaceName: "Acme",
        role: "owner",
        previousRole: "member",
        token: "secret",
      }).success
    ).toBe(false);
  });
});
