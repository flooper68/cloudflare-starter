/**
 * Nightly: erases QA accounts that aborted runs left on the deployed app (CI workflow
 * `QA`, job `cleanup`). Signs in as the QA admin (QA_ADMIN_EMAIL, an address in the QA
 * domain with the platform admin role and no second factor) through the real form, then
 * uses the admin portal's own API: `admin.users.list` to find `qa-<runId>-<role>@<domain>`
 * accounts older than two hours, `admin.workspaces.delete` for shared workspaces they own
 * whose members are all QA accounts, and `admin.users.remove` (the same erasure as the
 * portal's Delete account). Never SQL. docs/guides/how-to-qa-a-deployment.md#nightly-cleanup
 */
import {
  callApp,
  expect,
  open,
  qaEnv,
  qaSkipReason,
  qaTest,
  signIn,
} from "../support";
import {
  LEFTOVER_MAX_PER_RUN,
  onlyQaMembers,
  selectLeftovers,
  type UserRow,
} from "../support/leftovers";

const adminEmail = process.env.QA_ADMIN_EMAIL?.trim().toLowerCase() ?? "";
const adminPassword = process.env.QA_ADMIN_PASSWORD ?? "";
const skip =
  qaSkipReason() ??
  (adminEmail && adminPassword
    ? null
    : "QA cleanup skipped: set QA_ADMIN_EMAIL and QA_ADMIN_PASSWORD (the QA admin account, docs/guides/how-to-qa-a-deployment.md#nightly-cleanup)");

qaTest.skip(skip !== null, skip ?? "");

interface UserPage {
  readonly items: readonly UserRow[];
  readonly nextCursor: string | null;
}

interface UserDetail {
  readonly workspaces: readonly {
    readonly id: string;
    readonly kind: "personal" | "shared";
    readonly role: string;
  }[];
}

interface WorkspaceDetail {
  readonly members: readonly { readonly email: string }[];
}

qaTest("erase QA accounts left by aborted runs", async ({ page }) => {
  const env = qaEnv();
  if (!adminEmail.endsWith(`@${env.emailDomain}`)) {
    throw new Error(
      `QA_ADMIN_EMAIL must be an address @${env.emailDomain} (the QA bypass covers only that domain)`
    );
  }
  await signIn(page, { email: adminEmail, password: adminPassword });
  await open(page, "/admin/overview");

  const rows: UserRow[] = [];
  let cursor: string | undefined;
  do {
    const result: UserPage = await callApp<UserPage>(
      page,
      "query",
      "admin.users.list",
      {
        search: `@${env.emailDomain}`,
        limit: 100,
        ...(cursor ? { cursor } : {}),
      }
    );
    rows.push(...result.items);
    cursor = result.nextCursor ?? undefined;
  } while (cursor);

  const leftovers = selectLeftovers(rows, {
    domain: env.emailDomain,
    adminEmail,
    now: new Date(),
  });
  expect(
    leftovers.length,
    `more than ${LEFTOVER_MAX_PER_RUN} QA leftovers: look before erasing`
  ).toBeLessThanOrEqual(LEFTOVER_MAX_PER_RUN);

  const erased: string[] = [];
  for (const user of leftovers) {
    const detail = await callApp<UserDetail>(page, "query", "admin.users.get", {
      userId: user.id,
    });
    for (const workspace of detail.workspaces) {
      if (workspace.kind !== "shared" || workspace.role !== "owner") continue;
      const { members } = await callApp<WorkspaceDetail>(
        page,
        "query",
        "admin.workspaces.get",
        { workspaceId: workspace.id }
      );
      // Only workspaces that hold QA accounts and nobody else go with them.
      if (!onlyQaMembers(members, env.emailDomain)) continue;
      await callApp(page, "mutation", "admin.workspaces.delete", {
        workspaceId: workspace.id,
      });
    }
    await callApp(page, "mutation", "admin.users.remove", { userId: user.id });
    erased.push(user.email);
  }
  console.log(
    `QA nightly cleanup: ${erased.length} leftover account(s) erased${erased.length ? `: ${erased.join(", ")}` : ""}`
  );
});
