/**
 * Pure planning helpers of `setup:qa-inbox` (scripts/setup-qa-inbox.ts): no I/O, tested in
 * qa-inbox-plan.test.ts.
 */

/** The QA inbox Worker's name (apps/qa-inbox/wrangler.jsonc `name`). */
export const QA_INBOX_WORKER = "cloudflare-starter-qa-inbox";
/** Its D1 database (apps/qa-inbox/wrangler.jsonc `d1_databases[0].database_name`). */
export const QA_INBOX_DATABASE = "cloudflare-starter-qa-inbox";

/**
 * The zone a mail subdomain belongs to: its last two labels (`qa.flooper.me` →
 * `flooper.me`). Zones under a multi-label public suffix (`example.co.uk`) need `--zone`.
 */
export function zoneOf(domain: string): string {
  return domain.split(".").slice(-2).join(".");
}

/** Whether `domain` is a strict subdomain of `zone` (never the zone itself). */
export function isSubdomainOf(domain: string, zone: string): boolean {
  return domain.endsWith(`.${zone}`) && domain.length > zone.length + 1;
}

/** The id of the database named `name` in `wrangler d1 list --json` output, or null. */
export function databaseIdFrom(listJson: string, name: string): string | null {
  let rows: unknown;
  try {
    rows = JSON.parse(listJson);
  } catch {
    return null;
  }
  if (!Array.isArray(rows)) return null;
  const row = rows.find(
    (entry): entry is { name: string; uuid: string } =>
      typeof entry === "object" &&
      entry !== null &&
      (entry as { name?: unknown }).name === name &&
      typeof (entry as { uuid?: unknown }).uuid === "string"
  );
  return row?.uuid ?? null;
}

/** The id `wrangler d1 create` printed (`"database_id": "<uuid>"`), or null. */
export function databaseIdFromCreate(output: string): string | null {
  return (
    /"database_id":\s*"([0-9a-f-]{36})"/.exec(output)?.[1] ??
    /database_id\s*=\s*"([0-9a-f-]{36})"/.exec(output)?.[1] ??
    null
  );
}

/** The inbox's one mailbox: QA addresses are its subaddresses (`qa+<tag>@<domain>`). */
export function inboxMailbox(domain: string): string {
  return `qa@${domain}`;
}

/** An Email Routing rule, as `GET /zones/<zone>/email/routing/rules` returns it. */
export interface RoutingRule {
  readonly id?: string;
  readonly name?: string;
  readonly enabled?: boolean;
  readonly priority?: number;
  readonly matchers?: readonly {
    readonly type?: string;
    readonly field?: string;
    readonly value?: string;
  }[];
  readonly actions?: readonly {
    readonly type?: string;
    readonly value?: readonly string[];
  }[];
}

/** The zone's Email Routing settings (`GET /zones/<zone>/email/routing`). */
export interface RoutingSettings {
  readonly enabled?: boolean;
  readonly status?: string;
  readonly name?: string;
  readonly support_subaddress?: boolean;
}

export type RulePlan =
  | { readonly action: "keep"; readonly reason: string }
  | { readonly action: "create"; readonly reason: string }
  | { readonly action: "conflict"; readonly reason: string };

function describeAction(rule: RoutingRule): string {
  return (rule.actions ?? [])
    .map(
      (action) =>
        `${action.type ?? "?"}${action.value?.length ? ` ${action.value.join(", ")}` : ""}`
    )
    .join("; ");
}

function describeMatch(rule: RoutingRule): string {
  return (rule.matchers ?? [])
    .map((matcher) =>
      matcher.type === "all"
        ? "everything else"
        : `${matcher.field ?? "to"} = ${matcher.value ?? "?"}`
    )
    .join(", ");
}

/**
 * What to do about the one rule the inbox needs: `qa@<domain>` → the Worker. Kept when it
 * exists as such and is enabled; created when no rule names the address; anything else
 * (the address routed elsewhere, or the rule disabled) is the owner's call, never
 * overwritten.
 */
export function rulePlan(
  rules: readonly RoutingRule[],
  address: string,
  worker: string
): RulePlan {
  const matching = rules.filter((rule) =>
    (rule.matchers ?? []).some(
      (matcher) =>
        matcher.type === "literal" &&
        matcher.value?.toLowerCase() === address.toLowerCase()
    )
  );
  if (matching.length === 0) {
    return { action: "create", reason: `no rule routes ${address} yet` };
  }
  const ours = matching.find(
    (rule) =>
      rule.enabled !== false &&
      rule.actions?.length === 1 &&
      rule.actions[0]?.type === "worker" &&
      rule.actions[0].value?.includes(worker)
  );
  if (ours && matching.length === 1) {
    return { action: "keep", reason: `${address} → ${worker} already` };
  }
  return {
    action: "conflict",
    reason: `${address} already has a rule (${matching.map((rule) => `${rule.enabled === false ? "disabled: " : ""}${describeAction(rule)}`).join(" | ")}); change or delete it in the dashboard, then re-run`,
  };
}

/**
 * The zone's current Email Routing state in plain lines, for the read-only preflight:
 * whether it is on, subaddressing, the catch-all, and every rule.
 */
export function describeRouting(input: {
  readonly zone: string;
  readonly settings: RoutingSettings | null;
  readonly catchAll: RoutingRule | null;
  readonly rules: readonly RoutingRule[];
  readonly subdomain: string;
  readonly subdomainReady: boolean;
}): string[] {
  const { settings, catchAll } = input;
  const lines = [
    `Email Routing on ${input.zone}: ${settings ? `${settings.enabled ? "enabled" : "disabled"} (status ${settings.status ?? "unknown"})` : "not set up"}`,
    `Subaddressing (support_subaddress): ${settings?.support_subaddress === true ? "on" : settings?.support_subaddress === false ? "off" : "unknown"}`,
    `Catch-all: ${catchAll ? `${catchAll.enabled ? "enabled" : "disabled"}, ${describeAction(catchAll) || "no action"}` : "none"}`,
    `${input.subdomain} MX/SPF records: ${input.subdomainReady ? "in place" : "missing"}`,
    "Rules (the catch-all aside):",
  ];
  for (const rule of input.rules.filter(
    (rule) => !(rule.matchers ?? []).some((matcher) => matcher.type === "all")
  )) {
    lines.push(
      `  - ${rule.enabled === false ? "[disabled] " : ""}${describeMatch(rule)} → ${describeAction(rule)}${rule.name ? ` (${rule.name})` : ""}`
    );
  }
  return lines;
}

/**
 * The literal `to` rules of the zone other than the inbox's: with subaddressing on, each
 * also receives `<local>+<anything>@` (until now those went to the catch-all).
 */
export function rulesGainingSubaddresses(
  rules: readonly RoutingRule[],
  address: string
): string[] {
  return rules.flatMap((rule) =>
    (rule.matchers ?? []).flatMap((matcher) =>
      matcher.type === "literal" &&
      matcher.value &&
      matcher.value.toLowerCase() !== address.toLowerCase() &&
      !matcher.value.split("@")[0]?.includes("+")
        ? [matcher.value]
        : []
    )
  );
}

/** One DNS record Email Routing needs, as `GET …/email/routing/dns` lists it. */
export interface RoutingDnsRecord {
  readonly type?: string;
  readonly name?: string;
  readonly content?: string;
  readonly priority?: number;
}

/**
 * Whether Email Routing is already set up for the subdomain: the DNS endpoint lists its
 * records and reports no missing or wrong ones.
 */
export function subdomainRoutingReady(response: {
  readonly result?: unknown;
  readonly errors?: readonly unknown[];
}): boolean {
  const result = response.result as
    | {
        readonly record?: readonly RoutingDnsRecord[];
        readonly errors?: readonly unknown[];
      }
    | readonly RoutingDnsRecord[]
    | undefined;
  if (!result) return false;
  if (Array.isArray(result)) {
    return (
      result.some((record) => record.type === "MX") &&
      (response.errors?.length ?? 0) === 0
    );
  }
  const records = (result as { record?: readonly RoutingDnsRecord[] }).record;
  const problems = (result as { errors?: readonly unknown[] }).errors;
  return (
    (records ?? []).some((record) => record.type === "MX") &&
    (problems?.length ?? 0) === 0
  );
}

/**
 * The records Email Routing creates for a subdomain: three MX records to Cloudflare's
 * inbound servers and an SPF TXT record. Priorities are chosen by Cloudflare per zone;
 * `GET /zones/<zone>/email/routing/dns?subdomain=<domain>` prints the exact ones.
 */
export function expectedRecords(domain: string): readonly string[] {
  return [
    `MX  ${domain}  route1.mx.cloudflare.net  (priority set by Cloudflare)`,
    `MX  ${domain}  route2.mx.cloudflare.net  (priority set by Cloudflare)`,
    `MX  ${domain}  route3.mx.cloudflare.net  (priority set by Cloudflare)`,
    `TXT ${domain}  "v=spf1 include:_spf.mx.cloudflare.net ~all"`,
  ];
}
