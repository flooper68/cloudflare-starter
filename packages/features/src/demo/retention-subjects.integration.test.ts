import { asc } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { seedDemoUser } from "../../test/demo-fixtures";
import { testDb } from "../../test/fixtures";
import { user } from "../accounts";
import { retentionSubjects } from "./retention-subjects";

describe("retentionSubjects", () => {
  it("leaves out admins, the bootstrap admin, protected addresses and the QA domain, case-insensitively", async () => {
    const now = new Date();
    for (const [email, role] of [
      ["visitor@example.test", "user"],
      ["norole@example.test", null],
      ["root@example.test", "admin"],
      ["both@example.test", "user, admin"],
      ["Founder@Flooper.test", "user"],
      ["owner@FLOOPER.test", "user"],
      ["qa+run@QA.flooper.test", "user"],
      ["qa@sub.qa.flooper.test", "user"],
      ["qa_flooper@example.test", "user"],
    ] as const)
      await seedDemoUser(email, now, { role, workspace: false });

    const found = await testDb()
      .select({ email: user.email })
      .from(user)
      .where(
        retentionSubjects({
          protectedEmails: ["owner@flooper.test"],
          bootstrapAdminEmail: "founder@flooper.test",
          qaEmailDomain: "qa.flooper.test",
        })
      )
      .orderBy(asc(user.email));
    expect(found.map((row) => row.email)).toEqual([
      "norole@example.test",
      "qa@sub.qa.flooper.test",
      "qa_flooper@example.test",
      "visitor@example.test",
    ]);
  });

  it("with no list, bootstrap admin or QA domain, leaves out only admins", async () => {
    const found = await testDb()
      .select({ email: user.email })
      .from(user)
      .where(
        retentionSubjects({
          protectedEmails: [],
          bootstrapAdminEmail: null,
          qaEmailDomain: null,
        })
      );
    expect(found.map((row) => row.email)).not.toContain("root@example.test");
    expect(found.map((row) => row.email)).toContain("Founder@Flooper.test");
  });
});
