/**
 * The generated parts of the docs: Markdown tables built from the code's own catalogs, so
 * the reference pages cannot drift. Each lives between `<!-- generated:<name> -->` and
 * `<!-- /generated:<name> -->` in a doc; reference.test.ts fails when one is out of date,
 * and `bun run docs:reference` rewrites them. Pure: the test passes the data in.
 * docs/guides/how-to-publish-docs-and-landing.md#generated-reference-pages
 */
import type { Setting } from "./settings";

/** Escapes a value for a Markdown table cell. */
export function cell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\n+/g, " ").trim();
}

const code = (text: string) => `\`${text}\``;

function table(
  head: readonly string[],
  rows: readonly (readonly string[])[]
): string {
  return [
    `| ${head.join(" | ")} |`,
    `| ${head.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(cell).join(" | ")} |`),
  ].join("\n");
}

/** Replaces the generated block `name` in `source`; throws when the markers are missing. */
export function replaceBlock(
  source: string,
  name: string,
  body: string
): string {
  const open = `<!-- generated:${name} -->`;
  const close = `<!-- /generated:${name} -->`;
  const start = source.indexOf(open);
  const end = source.indexOf(close);
  if (start === -1 || end === -1 || end < start)
    throw new Error(`No ${open} … ${close} block`);
  return `${source.slice(0, start + open.length)}\n\n${body.trim()}\n\n${source.slice(end)}`;
}

// ---------------------------------------------------------------------------------------

/**
 * `docExists`: whether a setting's doc is in the repository (a project that stripped a
 * starter-only part has no guide for it; the row then has no link).
 */
export function settingsMarkdown(
  settings: readonly Setting[],
  docExists: (path: string) => boolean = () => true
): string {
  const groups = [...new Set(settings.map((setting) => setting.group))];
  return groups
    .map((group) => {
      const rows = settings
        .filter((setting) => setting.group === group)
        .map((setting) => [
          code(setting.name),
          setting.kind,
          setting.values ? setting.values.map(code).join(", ") : "text",
          docExists(setting.doc)
            ? `${setting.description} [Docs](${docLink(setting.doc)})`
            : setting.description,
        ]);
      return `### ${group}\n\n${table(["Setting", "Kind", "Values", "What it does"], rows)}`;
    })
    .join("\n\n");
}

/** A repository path as a link from docs/reference/. */
function docLink(path: string): string {
  return path.startsWith("docs/")
    ? `../${path.slice("docs/".length)}`
    : `../../${path}`;
}

export interface ToolRow {
  readonly name: string;
  readonly title: string;
  readonly kind: "read" | "write";
  readonly procedures: readonly string[];
  readonly outward?: boolean;
  readonly destructive?: boolean;
}

export function agentToolsMarkdown(tools: readonly ToolRow[]): string {
  const area = (tool: ToolRow) =>
    tool.name.startsWith("admin_") ||
    tool.procedures.some((p) => p.startsWith("admin."))
      ? "Admin (platform admins only)"
      : "Everyone";
  const groups = ["Everyone", "Admin (platform admins only)"];
  return groups
    .map((group) => {
      const rows = [...tools]
        .filter((tool) => area(tool) === group)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((tool) => [
          code(tool.name),
          tool.title,
          [
            tool.kind,
            tool.outward ? "outward" : "",
            tool.destructive ? "destructive" : "",
          ]
            .filter(Boolean)
            .join(", "),
          tool.procedures.map(code).join(", "),
        ]);
      return `### ${group}\n\n${table(["Tool", "Does", "Kind", "Procedures"], rows)}`;
    })
    .join("\n\n");
}

export function exemptionsMarkdown(
  exempt: Readonly<Record<string, string>>
): string {
  return table(
    ["Procedure", "Why it has no tool"],
    Object.entries(exempt).map(([path, why]) => [code(path), why])
  );
}

export interface RateLimitRow {
  readonly id: string;
  readonly limit: number;
  readonly periodSeconds: number;
  readonly scope: string;
  readonly enforcer: string;
  readonly description: string;
}

export function rateLimitsMarkdown(rows: readonly RateLimitRow[]): string {
  return table(
    ["Policy", "Limit", "Per", "Enforced by", "Covers"],
    rows.map((row) => [
      code(row.id),
      `${row.limit} / ${row.periodSeconds} s`,
      row.scope,
      row.enforcer,
      row.description,
    ])
  );
}

export function auditActionsMarkdown(actions: readonly string[]): string {
  const byArea = new Map<string, string[]>();
  for (const action of [...actions].sort()) {
    const area = action.split(".")[0] as string;
    byArea.set(area, [...(byArea.get(area) ?? []), action]);
  }
  return table(
    ["Area", "Actions"],
    [...byArea].map(([area, list]) => [code(area), list.map(code).join(", ")])
  );
}

export interface NotificationRow {
  readonly type: string;
  readonly label: string;
  readonly inApp: boolean;
  readonly email: boolean;
  readonly securityCritical: boolean;
}

export function notificationsMarkdown(
  rows: readonly NotificationRow[]
): string {
  const yes = (value: boolean) => (value ? "yes" : "no");
  return table(
    ["Type", "Shown as", "In the app", "Email", "Security notice"],
    rows.map((row) => [
      code(row.type),
      row.label,
      yes(row.inApp),
      yes(row.email),
      yes(row.securityCritical),
    ])
  );
}

export interface FlagRow {
  readonly key: string;
  readonly type: string;
  readonly defaultValue: string;
  readonly client: boolean;
  readonly description: string;
  readonly removeWhen: string;
}

export function flagsMarkdown(rows: readonly FlagRow[]): string {
  return table(
    [
      "Flag",
      "Type",
      "Default",
      "In the browser",
      "What it does",
      "Remove when",
    ],
    rows.map((row) => [
      code(row.key),
      row.type,
      code(row.defaultValue),
      row.client ? "yes" : "no",
      row.description,
      row.removeWhen,
    ])
  );
}

export interface EventRow {
  readonly name: string;
  readonly client: boolean;
  /** Sent anonymously by the public pages (`POST /api/site-events`). */
  readonly site?: boolean;
  readonly description: string;
}

export function eventsMarkdown(rows: readonly EventRow[]): string {
  return table(
    ["Event", "Sent from", "What happened"],
    rows.map((row) => [
      code(row.name),
      row.client ? "app (browser)" : row.site ? "public pages" : "server",
      row.description,
    ])
  );
}

export function jobsMarkdown(
  jobs: readonly string[],
  crons: readonly { readonly name: string; readonly schedule: string }[]
): string {
  return [
    "**Jobs**",
    "",
    table(
      ["Job"],
      [...jobs].sort().map((job) => [code(job)])
    ),
    "",
    "**Schedules** (UTC)",
    "",
    table(
      ["Schedule", "When"],
      crons.map((cron) => [code(cron.name), code(cron.schedule)])
    ),
  ].join("\n");
}

export interface CostRow {
  readonly item: string;
  readonly included: string;
  readonly above: string;
}

export function costsMarkdown(rows: readonly CostRow[], note: string): string {
  return `${table(
    ["What", "Included every month", "Above that"],
    rows.map((row) => [row.item, row.included, row.above])
  )}\n\n${note}`;
}

export interface FeatureListPillar {
  readonly id: string;
  readonly title: string;
}

export interface FeatureListGroup {
  readonly id: string;
  readonly pillar: string;
  readonly title: string;
  /** The group's docs page, as a URL. */
  readonly href: string;
}

export interface FeatureListEntry {
  readonly name: string;
  readonly group: string;
  readonly status: "built" | "demo" | "planned";
}

/**
 * The README's compact feature list (from apps/web/src/content/features.ts): the counts
 * by status, one line per group under its pillar with the built and demo features (demo
 * marked), then the planned ones under `roadmapHref`.
 */
export function featureListMarkdown(
  pillars: readonly FeatureListPillar[],
  groups: readonly FeatureListGroup[],
  features: readonly FeatureListEntry[],
  roadmapHref: string
): string {
  const count = (status: FeatureListEntry["status"]) =>
    features.filter((feature) => feature.status === status).length;
  const label = (feature: FeatureListEntry) =>
    feature.status === "demo" ? `${feature.name} _(demo)_` : feature.name;
  const lines = [
    `${count("built")} built, ${count("demo")} demo, ${count("planned")} planned.`,
  ];
  for (const pillar of pillars) {
    lines.push("", `**${pillar.title}**`, "");
    for (const group of groups.filter((entry) => entry.pillar === pillar.id)) {
      const names = features
        .filter(
          (feature) =>
            feature.group === group.id && feature.status !== "planned"
        )
        .map(label);
      if (names.length)
        lines.push(`- [${group.title}](${group.href}): ${names.join(" · ")}`);
    }
  }
  const planned = features.filter((feature) => feature.status === "planned");
  if (planned.length)
    lines.push(
      "",
      `**[Planned](${roadmapHref})**`,
      "",
      planned.map(label).join(" · ")
    );
  return lines.join("\n");
}
