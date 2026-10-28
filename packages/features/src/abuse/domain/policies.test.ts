import { describe, expect, it } from "vitest";

import {
  EDGE_PERIODS,
  mutationPolicy,
  PROCEDURE_POLICIES,
  RATE_LIMIT_EXEMPT,
  RATE_LIMIT_POLICIES,
  type RateLimitPolicy,
  ROUTE_POLICIES,
} from "./policies";

const policies = Object.entries(RATE_LIMIT_POLICIES) as [
  string,
  RateLimitPolicy,
][];

describe("rate-limit catalog", () => {
  it("uses dotted lower-case ids", () => {
    for (const [id] of policies) expect(id).toMatch(/^[a-z0-9-]+\.[a-z-]+$/);
  });

  it.each(policies.filter(([, p]) => p.enforcer === "edge"))(
    "edge policy %s names a binding and a period of 10 or 60 seconds",
    (_, policy) => {
      expect(policy.binding).toMatch(/^RL_[A-Z_]+$/);
      expect(EDGE_PERIODS).toContain(policy.periodSeconds);
      expect(policy.authPath).toBeUndefined();
    }
  );

  it.each(policies.filter(([, p]) => p.enforcer === "better-auth"))(
    "Better Auth policy %s names a path and no binding",
    (_, policy) => {
      expect(policy.authPath).toMatch(/^\//);
      expect(policy.binding).toBeUndefined();
    }
  );

  it("gives each Better Auth path one policy", () => {
    const paths = policies.map(([, p]) => p.authPath).filter(Boolean);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("gives policies sharing a binding the same limit and period", () => {
    const byBinding = new Map<string, RateLimitPolicy>();
    for (const [, policy] of policies) {
      if (!policy.binding) continue;
      const first = byBinding.get(policy.binding) ?? policy;
      byBinding.set(policy.binding, first);
      expect([policy.limit, policy.periodSeconds]).toEqual([
        first.limit,
        first.periodSeconds,
      ]);
    }
  });

  it("allows at least one request per period", () => {
    for (const [, policy] of policies) {
      expect(policy.limit).toBeGreaterThan(0);
      expect(Number.isInteger(policy.limit)).toBe(true);
    }
  });

  it("maps procedures and routes only to edge policies", () => {
    const used = [
      ...Object.values(PROCEDURE_POLICIES),
      ...Object.values(ROUTE_POLICIES).flat(),
    ];
    for (const id of used) {
      expect(RATE_LIMIT_POLICIES[id].enforcer).toBe("edge");
    }
  });

  it("limits MCP users more loosely than mutations", () => {
    expect(RATE_LIMIT_POLICIES["mcp.user"].limit).toBeGreaterThan(
      RATE_LIMIT_POLICIES["mutation.user"].limit
    );
  });

  it("does not both limit and exempt anything", () => {
    const limited = [
      ...Object.keys(PROCEDURE_POLICIES),
      ...Object.keys(ROUTE_POLICIES),
    ];
    expect(limited.filter((key) => key in RATE_LIMIT_EXEMPT)).toEqual([]);
  });
});

describe("mutationPolicy", () => {
  it("uses the procedure's own policy", () => {
    expect(mutationPolicy("storage.createUpload")).toBe("upload.user");
  });

  it("limits invitations by invitation.send", () => {
    expect(mutationPolicy("workspace.invitations.create")).toBe(
      "invitation.send"
    );
  });

  it("falls back to mutation.user", () => {
    expect(mutationPolicy("queue.enqueueHello")).toBe("mutation.user");
  });

  it("returns null for an exempt entry", () => {
    expect(mutationPolicy("api/hello.ts")).toBeNull();
  });
});
