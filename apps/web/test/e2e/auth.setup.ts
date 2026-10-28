import { test as setup } from "@playwright/test";

import { newAccount, sharedSession, signUp } from "./helpers";

// One user for every journey that only needs to be signed in.
setup("sign up the shared user", async ({ page }) => {
  await signUp(page, newAccount("shared"));
  await page.context().storageState({ path: sharedSession });
});
