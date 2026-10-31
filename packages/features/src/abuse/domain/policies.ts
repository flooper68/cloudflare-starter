/**
 * The rate-limit catalog: every limit the app enforces, in one place. Edge policies run
 * on a Workers Rate Limiting binding (cheap, per Cloudflare location, approximate);
 * Better Auth policies run in Better Auth's own limiter (counters in D1, exact).
 * docs/guides/how-to-configure-abuse-protection.md explains how to add one.
 */

/** Who a limit counts: the client IP, or the signed-in user (the IP when anonymous). */
export type RateLimitScope = "ip" | "user";

/** What enforces the policy. */
export type RateLimitEnforcer = "edge" | "better-auth";

export interface RateLimitPolicy {
  /** Requests allowed per period. */
  readonly limit: number;
  /** Window length. Edge policies allow only 10 or 60 (a Workers Rate Limiting rule). */
  readonly periodSeconds: number;
  readonly scope: RateLimitScope;
  readonly enforcer: RateLimitEnforcer;
  /** Edge policies: the Workers Rate Limiting binding in apps/web/wrangler.jsonc. */
  readonly binding?: string;
  /** Better Auth policies: the path pattern under /api/auth it applies to. */
  readonly authPath?: string;
  /** What it protects, for people reading the catalog. */
  readonly description: string;
}

/** Periods a Workers Rate Limiting binding accepts. */
export const EDGE_PERIODS: readonly number[] = [10, 60];

export const RATE_LIMIT_POLICIES = {
  "auth.ip": {
    limit: 60,
    periodSeconds: 60,
    scope: "ip",
    enforcer: "edge",
    binding: "RL_AUTH_IP",
    description: "Every /api/auth/* request, per IP, before Better Auth runs",
  },
  "auth.sign-in": {
    limit: 10,
    periodSeconds: 60,
    scope: "ip",
    enforcer: "better-auth",
    authPath: "/sign-in/*",
    description: "Sign-in attempts (password guessing)",
  },
  "auth.sign-up": {
    limit: 5,
    periodSeconds: 60,
    scope: "ip",
    enforcer: "better-auth",
    authPath: "/sign-up/*",
    description: "Account creation",
  },
  "auth.change-email": {
    limit: 3,
    periodSeconds: 60,
    scope: "ip",
    enforcer: "better-auth",
    authPath: "/change-email",
    description: "Account email change requests",
  },
  "auth.delete-user": {
    limit: 3,
    periodSeconds: 3600,
    scope: "ip",
    enforcer: "better-auth",
    authPath: "/delete-user",
    description: "Account deletion attempts",
  },
  "auth.password-reset": {
    limit: 3,
    periodSeconds: 60,
    scope: "ip",
    enforcer: "better-auth",
    authPath: "/request-password-reset",
    description: "Password reset mails",
  },
  "auth.verification-email": {
    limit: 3,
    periodSeconds: 60,
    scope: "ip",
    enforcer: "better-auth",
    authPath: "/send-verification-email",
    description:
      "Verification mails on request (anonymous, to any address; no human check: no form of ours sends it)",
  },
  "auth.oauth-register": {
    limit: 5,
    periodSeconds: 3600,
    scope: "ip",
    enforcer: "better-auth",
    authPath: "/oauth2/register",
    description: "Dynamic OAuth client registration (MCP clients)",
  },
  "auth.oauth-token": {
    limit: 10,
    periodSeconds: 60,
    scope: "ip",
    enforcer: "better-auth",
    authPath: "/oauth2/token",
    description: "OAuth token exchange and refresh",
  },
  "auth.oauth-authorize": {
    limit: 10,
    periodSeconds: 60,
    scope: "ip",
    enforcer: "better-auth",
    authPath: "/oauth2/authorize",
    description: "OAuth authorization requests",
  },
  "mutation.user": {
    limit: 60,
    periodSeconds: 60,
    scope: "user",
    enforcer: "edge",
    binding: "RL_MUTATION",
    description: "Every tRPC mutation without a more specific policy",
  },
  "upload.user": {
    limit: 20,
    periodSeconds: 60,
    scope: "user",
    enforcer: "edge",
    binding: "RL_UPLOAD",
    description: "File uploads: POST /api/files and storage.createUpload",
  },
  "mcp.ip": {
    // High: MCP clients such as Claude call from shared server IPs.
    limit: 600,
    periodSeconds: 60,
    scope: "ip",
    enforcer: "edge",
    binding: "RL_MCP_IP",
    description:
      "Every /mcp request, per IP, before the token is verified (MCP clients share server IPs)",
  },
  "mcp.user": {
    limit: 120,
    periodSeconds: 60,
    scope: "user",
    enforcer: "edge",
    binding: "RL_MCP_USER",
    description:
      "Every /mcp request, per token user; tool calls that mutate also count against their mutation policy",
  },
  "token.lookup": {
    limit: 30,
    periodSeconds: 60,
    scope: "ip",
    enforcer: "edge",
    binding: "RL_TOKEN_LOOKUP",
    description:
      "Pages that look up a token from the URL (invitation links), per IP, against guessing",
  },
  "notifications.unsubscribe": {
    limit: 20,
    periodSeconds: 60,
    scope: "ip",
    enforcer: "edge",
    binding: "RL_UNSUBSCRIBE",
    description:
      "One-click unsubscribe POSTs from mail links (RFC 8058), per IP: anonymous, authorized by a signed token",
  },
  "billing.webhook": {
    // High: a payment provider sends from a few shared IPs, in bursts after an outage.
    limit: 300,
    periodSeconds: 60,
    scope: "ip",
    enforcer: "edge",
    binding: "RL_BILLING_WEBHOOK",
    description:
      "The billing provider's webhook (POST /api/billing/webhook), per IP, before the signature is checked",
  },
  "invitation.send": {
    limit: 10,
    periodSeconds: 60,
    scope: "user",
    enforcer: "edge",
    binding: "RL_INVITE",
    description: "Invitations a user sends (mail to other people)",
  },
  "analytics.client": {
    limit: 120,
    periodSeconds: 60,
    scope: "user",
    enforcer: "edge",
    binding: "RL_ANALYTICS",
    description:
      "Client analytics batches (analytics.track), per user; kept apart from mutation.user so telemetry never uses up a user's mutations",
  },
} as const satisfies Readonly<Record<string, RateLimitPolicy>>;

export type RateLimitPolicyId = keyof typeof RATE_LIMIT_POLICIES;

/** The policy of a tRPC mutation that is not `mutation.user`, by procedure path. */
export const PROCEDURE_POLICIES: Readonly<Record<string, RateLimitPolicyId>> = {
  "storage.createUpload": "upload.user",
  // Mails a link to a typed-in address.
  "workspace.invitations.create": "invitation.send",
  // Client telemetry: frequent, cheap, its own budget.
  "analytics.track": "analytics.client",
};

/** Every tRPC mutation without an entry in PROCEDURE_POLICIES. */
export const DEFAULT_MUTATION_POLICY: RateLimitPolicyId = "mutation.user";

/**
 * The policies each non-tRPC endpoint applies, by file under apps/web/src/pages (endpoints,
 * and .astro pages that look up a token from the URL).
 * test/architecture/abuse.test.ts checks that each file uses them.
 */
export const ROUTE_POLICIES: Readonly<
  Record<string, readonly RateLimitPolicyId[]>
> = {
  "api/auth/[...all].ts": ["auth.ip"],
  "api/files/index.ts": ["upload.user"],
  "api/workspaces/[workspaceId]/logo/index.ts": ["upload.user"],
  "api/account/avatar/index.ts": ["upload.user"],
  "api/billing/webhook.ts": ["billing.webhook"],
  "mcp.ts": ["mcp.ip", "mcp.user"],
  "invite/[token].astro": ["token.lookup"],
  "api/notifications/unsubscribe.ts": ["notifications.unsubscribe"],
  "unsubscribe.astro": ["token.lookup"],
};

/**
 * Mutations and endpoints deliberately not rate limited, with the reason: a tRPC
 * procedure path or a file under apps/web/src/pages. Keep it short.
 */
export const RATE_LIMIT_EXEMPT: Readonly<Record<string, string>> = {
  "api/workspaces/[workspaceId]/logo/[version].ts":
    "authenticated immutable current profile image read",
  "api/account/avatar/[version].ts":
    "authenticated immutable current profile image read",
  "api/trpc/[...trpc].ts":
    "each mutation is limited by the tRPC middleware with its own policy",
  "api/hello.ts": "public read-only example with no state or cost behind it",
  "api/files/[id].ts":
    "authenticated read of the user's own file; reads are not limited",
  ".well-known/[...path].ts": "static OAuth discovery documents",
  "reset-password.astro":
    "only hands the token to the form; Better Auth checks it under auth.ip",
};

/** The policy a tRPC mutation is limited by, or null when it is exempt. */
export function mutationPolicy(path: string): RateLimitPolicyId | null {
  if (path in RATE_LIMIT_EXEMPT) return null;
  return PROCEDURE_POLICIES[path] ?? DEFAULT_MUTATION_POLICY;
}
