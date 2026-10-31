import { describe, expect, it } from "vitest";
import { notificationDestination } from "./notification-navigation";

const base = "https://app.example.test/app/notifications";
describe("notificationDestination", () => {
  it("keeps only same-origin app/admin paths in the SPA", () => {
    for (const path of [
      "/app",
      "/app/members?workspaceId=team#people",
      "/admin/users/user-1",
    ])
      expect(notificationDestination(path, base)).toEqual({
        kind: "spa",
        href: path,
      });
    expect(
      notificationDestination(
        "https://app.example.test/app/settings/privacy",
        base
      )
    ).toEqual({ kind: "spa", href: "/app/settings/privacy" });
  });
  it("uses native navigation for signed downloads and other documents", () => {
    const path =
      "/api/privacy/exports/request-1?expires=123&signature=synthetic";
    expect(notificationDestination(path, base)).toEqual({
      kind: "document",
      href: `https://app.example.test${path}`,
    });
    expect(notificationDestination("/invite/invitation", base)?.kind).toBe(
      "document"
    );
    expect(notificationDestination("/application", base)?.kind).toBe(
      "document"
    );
    expect(
      notificationDestination("https://docs.example.test/admin/guide", base)
    ).toEqual({
      kind: "document",
      href: "https://docs.example.test/admin/guide",
    });
  });
  it("normalizes relative HTTP(S) paths safely", () => {
    expect(notificationDestination("settings/privacy", base)).toEqual({
      kind: "spa",
      href: "/app/settings/privacy",
    });
    expect(notificationDestination("../../api/download", base)).toEqual({
      kind: "document",
      href: "https://app.example.test/api/download",
    });
    expect(
      notificationDestination("//docs.example.test/help", base)?.href
    ).toBe("https://docs.example.test/help");
  });
  it("refuses executable, non-HTTP and malformed URLs", () => {
    for (const href of [
      null,
      "",
      " ",
      "javascript:alert(1)",
      "java\nscript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "file:///tmp/private",
      "blob:https://app.example.test/x",
      "https://[",
    ])
      expect(notificationDestination(href, base)).toBeNull();
  });
});
