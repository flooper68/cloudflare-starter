import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test as setup } from "@playwright/test";

import { adminAccounts, newAccount, signOut, signUp } from "./helpers";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

// The admin journeys' two accounts: an admin (made one the documented way, with
// `bun run setup:admin` on the local D1 the dev server uses) and a member they act on.
setup("sign up an admin and a member", async ({ page }) => {
  const admin = newAccount("admin");
  const member = newAccount("member");
  await signUp(page, member);
  await signOut(page);
  await signUp(page, admin);
  await signOut(page);
  execFileSync("bun", ["scripts/setup-admin.ts", "--email", admin.email], {
    cwd: ROOT,
    stdio: "pipe",
  });
  mkdirSync(dirname(adminAccounts), { recursive: true });
  writeFileSync(adminAccounts, JSON.stringify({ admin, member }));
});
