/**
 * The recordings' MCP client, "Demo MCP client": registers itself (RFC 7591), sends the
 * person to the consent page, exchanges the code and calls tools on /mcp, the same flow
 * as test/e2e/connected-agents.spec.ts and as Claude. Its callback is answered by the
 * recorder with a small page, so nothing leaves the machine.
 */
import { createHash, randomBytes } from "node:crypto";
import type { APIRequestContext, Page } from "@playwright/test";

export const AGENT_NAME = "Demo MCP client";
export const AGENT_CALLBACK = "https://agent.demo.test/callback";
const SCOPE = "openid profile email offline_access";

export interface ToolResult {
  readonly status: number;
  readonly ok: boolean;
  /** The tool's text content, or the error. */
  readonly text: string;
}

export class DemoAgent {
  private clientId = "";
  private verifier = "";
  private code: string | null = null;
  private token = "";

  constructor(
    private readonly request: APIRequestContext,
    private readonly baseURL: string
  ) {}

  private get mcp() {
    return `${this.baseURL}/mcp`;
  }

  async register(): Promise<void> {
    const response = await this.request.post(
      `${this.baseURL}/api/auth/oauth2/register`,
      {
        headers: { origin: this.baseURL },
        data: {
          client_name: AGENT_NAME,
          redirect_uris: [AGENT_CALLBACK],
          token_endpoint_auth_method: "none",
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
          scope: SCOPE,
          resources: [this.mcp],
        },
      }
    );
    if (response.status() !== 201)
      throw new Error(
        `register: ${response.status()} ${await response.text()}`
      );
    this.clientId = (
      (await response.json()) as { client_id: string }
    ).client_id;
  }

  /**
   * Answers the callback in `page` with a small "connected" page and returns the
   * authorize URL to open.
   */
  async authorizeUrl(page: Page): Promise<string> {
    this.verifier = randomBytes(48).toString("base64url");
    const challenge = createHash("sha256")
      .update(this.verifier)
      .digest("base64url");
    await page.route(`${AGENT_CALLBACK}*`, (route) => {
      this.code = new URL(route.request().url()).searchParams.get("code");
      return route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><meta charset="utf-8"><title>${AGENT_NAME}</title><body style="margin:0;display:grid;place-items:center;height:100vh;background:#0b0d10;color:#f2f4f7;font:16px system-ui"><p>${AGENT_NAME} is connected. You can close this tab.</p></body>`,
      });
    });
    return `${this.baseURL}/api/auth/oauth2/authorize?${new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: AGENT_CALLBACK,
      response_type: "code",
      code_challenge: challenge,
      code_challenge_method: "S256",
      scope: SCOPE,
      resource: this.mcp,
      state: "demo",
      prompt: "consent",
    })}`;
  }

  async exchange(): Promise<void> {
    if (!this.code) throw new Error("no authorization code yet");
    const response = await this.request.post(
      `${this.baseURL}/api/auth/oauth2/token`,
      {
        headers: { origin: this.baseURL },
        form: {
          grant_type: "authorization_code",
          client_id: this.clientId,
          code: this.code,
          code_verifier: this.verifier,
          redirect_uri: AGENT_CALLBACK,
          resource: this.mcp,
        },
      }
    );
    if (response.status() !== 200)
      throw new Error(`token: ${response.status()} ${await response.text()}`);
    this.token = (
      (await response.json()) as { access_token: string }
    ).access_token;
  }

  get connected(): boolean {
    return this.code !== null;
  }

  async call(
    name: string,
    args: Record<string, unknown> = {}
  ): Promise<ToolResult> {
    const response = await this.request.post(this.mcp, {
      headers: {
        authorization: `Bearer ${this.token}`,
        accept: "application/json, text/event-stream",
      },
      data: {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name, arguments: args },
      },
    });
    const status = response.status();
    const raw = await response.text();
    if (status !== 200) return { status, ok: false, text: raw.slice(0, 200) };
    // A JSON-RPC answer, possibly as one server-sent event.
    const json = raw.startsWith("{")
      ? raw
      : (/^data: (.*)$/m.exec(raw)?.[1] ?? "{}");
    const body = JSON.parse(json) as {
      result?: { isError?: boolean; content?: { text?: string }[] };
      error?: { message?: string };
    };
    if (body.error)
      return { status, ok: false, text: body.error.message ?? "error" };
    const text = body.result?.content?.map((part) => part.text).join("") ?? "";
    return { status, ok: !body.result?.isError, text };
  }
}
