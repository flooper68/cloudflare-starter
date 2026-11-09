/**
 * The generated parts of the docs match the code (generate.ts): settings, agent tools,
 * catalogs and costs. `bun run docs:reference` (UPDATE_REFERENCE=1) rewrites them. Also:
 * every setting the app reads is listed in settings.ts, and nothing there is unused.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AUDIT_ACTIONS,
  analyticsEvents,
  cronCatalog,
  FLAGS,
  jobCatalog,
  notificationCatalog,
  RATE_LIMIT_POLICIES,
} from "@cloudflare-starter/features";
import { parse } from "jsonc-parser";
import { describe, expect, it } from "vitest";

import { docsHref, FEATURES, GROUPS, PILLARS } from "@/content/features";
import { RECEIPT, SECTIONS } from "@/landing/content";
import { MCP_EXEMPT_PROCEDURES, MCP_TOOLS } from "@/server/mcp/tools";

import {
  agentToolsMarkdown,
  auditActionsMarkdown,
  costsMarkdown,
  eventsMarkdown,
  exemptionsMarkdown,
  featureListMarkdown,
  flagsMarkdown,
  jobsMarkdown,
  notificationsMarkdown,
  rateLimitsMarkdown,
  replaceBlock,
  settingsMarkdown,
} from "./generate";
import { SETTINGS } from "./settings";

const ROOT = fileURLToPath(new URL("../../../../../", import.meta.url));
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const UPDATE = process.env.UPDATE_REFERENCE === "1";

/** `KEY=value` and commented `# KEY=value` lines of .dev.vars.example. */
function devVars(): Map<string, string> {
  const vars = new Map<string, string>();
  for (const line of read("apps/web/.dev.vars.example").split("\n")) {
    const match = /^(#\s*)?([A-Z][A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!match) continue;
    const [, commented, key, value] = match as unknown as [
      string,
      string | undefined,
      string,
      string,
    ];
    if (!vars.has(key) || !commented)
      vars.set(key, commented ? "" : value.trim());
  }
  return vars;
}

/** Every var name in apps/web/wrangler.jsonc, top level and each environment. */
function wranglerVars(): Set<string> {
  const config = parse(read("apps/web/wrangler.jsonc")) as {
    vars?: Record<string, unknown>;
    env?: Record<string, { vars?: Record<string, unknown> }>;
  };
  return new Set([
    ...Object.keys(config.vars ?? {}),
    ...Object.values(config.env ?? {}).flatMap((env) =>
      Object.keys(env.vars ?? {})
    ),
  ]);
}

/** Where the README's links to the docs point: the starter's own deployment. */
const SITE = "https://starter.flooper.me";

/**
 * The README is the starter's front page until `starter:strip` resets it (the marketing
 * component); a project's README has no generated blocks.
 */
const starterReadme = (
  JSON.parse(read("starter-only.json")) as {
    components: { id: string; status: string }[];
  }
).components.some(
  (component) => component.id === "marketing" && component.status !== "stripped"
);

const README_BLOCKS: readonly {
  file: string;
  name: string;
  render: () => string;
}[] = [
  {
    file: "README.md",
    name: "costs",
    render: () => costsMarkdown(RECEIPT, SECTIONS.costs.note),
  },
  {
    file: "README.md",
    name: "features",
    render: () =>
      featureListMarkdown(
        PILLARS,
        GROUPS.map((group) => ({
          ...group,
          href: SITE + docsHref(group.docs),
        })),
        FEATURES
      ),
  },
];

const BLOCKS: readonly { file: string; name: string; render: () => string }[] =
  [
    ...(starterReadme ? README_BLOCKS : []),
    {
      file: "docs/reference/settings.md",
      name: "settings",
      render: () =>
        settingsMarkdown(SETTINGS, (path) => existsSync(join(ROOT, path))),
    },
    {
      file: "docs/reference/agent-tools.md",
      name: "agent-tools",
      render: () => agentToolsMarkdown(MCP_TOOLS),
    },
    {
      file: "docs/reference/agent-tools.md",
      name: "agent-tool-exemptions",
      render: () => exemptionsMarkdown(MCP_EXEMPT_PROCEDURES),
    },
    {
      file: "docs/reference/catalogs.md",
      name: "rate-limits",
      render: () =>
        rateLimitsMarkdown(
          Object.entries(RATE_LIMIT_POLICIES).map(([id, policy]) => ({
            id,
            ...policy,
          }))
        ),
    },
    {
      file: "docs/reference/catalogs.md",
      name: "audit-actions",
      render: () => auditActionsMarkdown(AUDIT_ACTIONS),
    },
    {
      file: "docs/reference/catalogs.md",
      name: "notifications",
      render: () =>
        notificationsMarkdown(
          [...notificationCatalog.values()].map((definition) => ({
            type: definition.type,
            label: definition.label,
            inApp: definition.defaultChannels.inApp,
            email: definition.defaultChannels.email,
            securityCritical: definition.securityCritical,
          }))
        ),
    },
    {
      file: "docs/reference/catalogs.md",
      name: "flags",
      render: () =>
        flagsMarkdown(
          Object.entries(FLAGS).map(([key, flag]) => ({
            key,
            type: flag.type,
            defaultValue: String(flag.default),
            client: flag.client,
            description: flag.description,
            removeWhen: flag.removeWhen,
          }))
        ),
    },
    {
      file: "docs/reference/catalogs.md",
      name: "events",
      render: () =>
        eventsMarkdown(
          [...analyticsEvents.values()].map((event) => ({
            name: event.name,
            client: event.client,
            description: event.description,
          }))
        ),
    },
    {
      file: "docs/reference/catalogs.md",
      name: "jobs",
      render: () =>
        jobsMarkdown(
          [...jobCatalog.keys()],
          cronCatalog.map((entry) => ({
            name: entry.name,
            schedule: entry.schedule,
          }))
        ),
    },
    {
      file: "docs/start/what-it-costs.md",
      name: "costs",
      render: () => costsMarkdown(RECEIPT, SECTIONS.costs.note),
    },
  ];

/** Table rows compared without their column padding (the formatter aligns tables). */
function normalize(markdown: string): string {
  return markdown
    .split("\n")
    .map((line) =>
      line.startsWith("|")
        ? line.replace(/ {2,}/g, " ").replace(/-{3,}/g, "---")
        : line
    )
    .join("\n");
}

describe("generated reference docs", () => {
  it.each(
    BLOCKS.map((block) => [`${block.file} › ${block.name}`, block] as const)
  )("%s is up to date (bun run docs:reference)", (_, block) => {
    const source = read(block.file);
    const next = replaceBlock(source, block.name, block.render());
    if (normalize(next) === normalize(source)) return;
    if (UPDATE) writeFileSync(join(ROOT, block.file), next);
    else
      expect(normalize(next), "run `bun run docs:reference`").toBe(
        normalize(source)
      );
  });
});

describe("settings catalog", () => {
  const listed = new Set(SETTINGS.map((setting) => setting.name));
  const used = new Set([...devVars().keys(), ...wranglerVars()]);

  it("lists every setting of .dev.vars.example and wrangler.jsonc", () => {
    expect([...used].filter((name) => !listed.has(name)).sort()).toEqual([]);
  });

  it("lists nothing the app does not read", () => {
    // A starter-only setting may be gone from a project that stripped it.
    const optional = new Set(
      SETTINGS.filter((setting) => setting.starterOnly).map((s) => s.name)
    );
    expect(
      [...listed]
        .filter((name) => !used.has(name) && !optional.has(name))
        .sort()
    ).toEqual([]);
  });

  it("has each setting once", () => {
    expect(listed.size).toBe(SETTINGS.length);
  });
});
