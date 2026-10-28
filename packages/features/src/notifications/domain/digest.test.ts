import { describe, expect, it } from "vitest";

import {
  DIGEST_SCHEDULE,
  type DigestEntry,
  digestContent,
  digestDate,
  groupDigest,
} from "./digest";

const joined = (name: string): DigestEntry => ({
  type: "workspaces.member-joined",
  label: "Someone joins a workspace you manage",
  title: `${name} joined Acme`,
  body: `${name} accepted your invitation.`,
  href: "/app/members",
});
const role: DigestEntry = {
  type: "workspaces.role-changed",
  label: "Your role in a workspace changes",
  title: "You are now Owner in Acme",
  body: "Your role changed.",
  href: null,
};

describe("digest", () => {
  it("groups entries by type in order of first appearance", () => {
    const groups = groupDigest([joined("Grace"), role, joined("Alan")]);
    expect(groups.map((g) => [g.type, g.entries.length])).toEqual([
      ["workspaces.member-joined", 2],
      ["workspaces.role-changed", 1],
    ]);
  });

  it("renders a subject with the count, text and escaped HTML", () => {
    const content = digestContent(
      [joined("<script>Eve</script>"), role],
      "https://app.example.test"
    );
    expect(content.subject).toBe("Your daily summary: 2 notifications");
    expect(content.text).toContain("Someone joins a workspace you manage (1)");
    expect(content.text).toContain("https://app.example.test/app/members");
    expect(content.html).toContain("&lt;script&gt;Eve&lt;/script&gt;");
    expect(content.html).not.toContain("<script>");
    expect(digestContent([role], "https://x.test").subject).toBe(
      "Your daily summary: 1 notification"
    );
  });

  it("dates a run by its UTC day and runs at 08:00 UTC", () => {
    expect(digestDate(new Date("2026-10-28T23:59:00.000Z"))).toBe("2026-10-28");
    expect(DIGEST_SCHEDULE).toBe("0 8 * * *");
  });
});
