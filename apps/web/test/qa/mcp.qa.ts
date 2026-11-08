import { createVerifiedAccount } from "./support/accounts";
import { callTool, connectMcpClient, type McpConnection } from "./support/mcp";
import {
  type Account,
  createWorkspace,
  open,
  openSettings,
} from "./support/session";
import {
  expect,
  newUserPage,
  type Page,
  skipWithoutQaEnv,
  test,
} from "./support/test";

// Checklist: MCP (connect a client and call a tool). One account. A test client registers
// itself through dynamic registration (5 an hour per IP: one per run), the person allows
// it on the real consent page, and its token calls read tools; Settings › Connected
// agents lists it, Disconnect revokes it, and the token is refused from then on.
skipWithoutQaEnv();
test.describe.configure({ mode: "serial" });

let page: Page;
let account: Account;
let connection: McpConnection;
const workspace = `QA ${process.env.QA_RUN_ID ?? "run"} mcp`;
const clientName = `QA agent ${process.env.QA_RUN_ID ?? "run"}`;

test.beforeAll(async ({ browser }) => {
  page = await newUserPage(browser);
  account = { ...(await createVerifiedAccount(page, { role: "mcp" })) };
  await createWorkspace(page, workspace);
});

test.afterAll(async () => {
  await page?.context().close();
});

test("a client registers, the consent page names it and its access, and Allow grants a token", async () => {
  connection = await connectMcpClient(page, clientName);
  expect(connection.accessToken).toBeTruthy();
});

test("read tools answer as the person, with their workspaces only", async () => {
  const whoami = await callTool(page, connection, "whoami");
  expect(whoami.status).toBe(200);
  expect(whoami.isError).toBe(false);
  expect(JSON.stringify(whoami.data)).toContain(account.email);

  const workspaces = await callTool(page, connection, "list_workspaces");
  expect(workspaces.status).toBe(200);
  const names = JSON.stringify(workspaces.data);
  expect(names).toContain(workspace);
  expect(names).not.toMatch(/QA \S+ (shared|files|notices|export)\b/);

  const files = await callTool(page, connection, "list_files");
  expect(files.status).toBe(200);
  expect(files.isError).toBe(false);

  const agents = await callTool(page, connection, "list_connected_agents");
  expect(agents.status).toBe(200);
  const self = JSON.stringify(agents.data);
  expect(self).toContain(clientName);
  expect(self).toMatch(/"thisConnection":\s*true/);
});

test("Settings › Connected agents lists it; Disconnect revokes it and the token is refused", async () => {
  await openSettings(page, "connected-agents");
  await expect(
    page.getByRole("heading", { name: "Connected agents", level: 2 })
  ).toBeVisible();
  const row = page.getByRole("listitem").filter({ hasText: clientName });
  await expect(row).toContainText("Approved in this browser");
  await expect(
    row.getByRole("list", { name: `What ${clientName} may do` })
  ).toContainText("Stay connected until you revoke it");

  await row.getByRole("button", { name: `Disconnect ${clientName}` }).click();
  await page
    .getByRole("alertdialog", { name: `Disconnect ${clientName}?` })
    .getByRole("button", { name: "Disconnect" })
    .click();
  await expect(page.getByText("Agent disconnected")).toBeVisible();
  await expect(page.getByText(clientName)).toHaveCount(0);

  const refused = await callTool(page, connection, "whoami");
  expect(refused.status).toBe(401);
  expect(refused.headers["www-authenticate"]).toContain(
    'error="invalid_token"'
  );
  await open(page, "/app/dashboard");
});
