import { createHash, randomBytes } from "node:crypto";

import { expect, test } from "./fixtures";
import { open, sharedSession } from "./helpers";

// Settings › Connected agents as the shared user: connect a test MCP client through the
// real OAuth flow and consent page, see it listed, disconnect it, and check its token is
// refused. No sign-up here.
test.use({ storageState: sharedSession });

const CALLBACK = "https://client.example.test/e2e-callback";

test("connect an MCP client, see it in Settings › Connected agents, disconnect it, and its token stops working", async ({
  page,
  baseURL,
}) => {
  const clientName = `E2E agent ${Date.now()}`;
  const mcp = `${baseURL}/mcp`;

  // The client registers itself (RFC 7591), as Claude does.
  const registered = await page.request.post("/api/auth/oauth2/register", {
    data: {
      client_name: clientName,
      redirect_uris: [CALLBACK],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: "openid profile email offline_access",
      resources: [mcp],
    },
  });
  expect(registered.status()).toBe(201);
  const { client_id: clientId } = (await registered.json()) as {
    client_id: string;
  };

  // The person allows it on the consent page; the client's callback receives the code.
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  let code: string | null = null;
  await page.route(`${CALLBACK}*`, (route) => {
    code = new URL(route.request().url()).searchParams.get("code");
    return route.fulfill({ contentType: "text/plain", body: "connected" });
  });
  const authorize = new URLSearchParams({
    client_id: clientId,
    redirect_uri: CALLBACK,
    response_type: "code",
    code_challenge: challenge,
    code_challenge_method: "S256",
    scope: "openid profile email offline_access",
    resource: mcp,
    state: "e2e-state",
    prompt: "consent",
  });
  await open(page, `/api/auth/oauth2/authorize?${authorize}`);
  await expect(page).toHaveURL(/\/consent\?/);
  await expect(page.getByText(clientName)).toBeVisible();
  await expect(page.getByText(/Settings › Connected agents/)).toBeVisible();
  await page.getByRole("button", { name: "Allow" }).click();
  await expect.poll(() => code).not.toBeNull();

  const token = await page.request.post("/api/auth/oauth2/token", {
    form: {
      grant_type: "authorization_code",
      client_id: clientId,
      code: code ?? "",
      code_verifier: verifier,
      redirect_uri: CALLBACK,
      resource: mcp,
    },
  });
  expect(token.status()).toBe(200);
  const { access_token: accessToken } = (await token.json()) as {
    access_token: string;
  };
  const callMcp = () =>
    page.request.post("/mcp", {
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/json, text/event-stream",
      },
      data: {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "whoami", arguments: {} },
      },
    });
  expect((await callMcp()).status()).toBe(200);

  // Listed, with the consent page's words and this browser as the approver.
  await open(page, "/app/settings/connected-agents");
  await expect(
    page.getByRole("heading", { name: "Connected agents", level: 2 })
  ).toBeVisible();
  const row = page.getByRole("listitem").filter({ hasText: clientName });
  await expect(row).toContainText("client.example.test");
  await expect(row).toContainText("Approved in this browser");
  await expect(
    row.getByRole("list", { name: `What ${clientName} may do` })
  ).toContainText("Stay connected until you revoke it");

  // Disconnect asks first, then removes it.
  await row.getByRole("button", { name: `Disconnect ${clientName}` }).click();
  const dialog = page.getByRole("alertdialog", {
    name: `Disconnect ${clientName}?`,
  });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Disconnect" }).click();
  await expect(page.getByText("Agent disconnected")).toBeVisible();
  await expect(page.getByText(clientName)).toHaveCount(0);

  // Its still-unexpired access token is refused from now on.
  const refused = await callMcp();
  expect(refused.status()).toBe(401);
  expect(refused.headers()["www-authenticate"]).toContain(
    'error="invalid_token"'
  );
});
