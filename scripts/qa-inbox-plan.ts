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

/** The zone's catch-all rule, as the Email Routing API returns it. */
export interface CatchAllRule {
  readonly enabled?: boolean;
  readonly actions?: readonly {
    readonly type?: string;
    readonly value?: readonly string[];
  }[];
}

export type CatchAllPlan =
  | { readonly action: "keep"; readonly reason: string }
  | { readonly action: "set"; readonly reason: string }
  | { readonly action: "conflict"; readonly reason: string };

/**
 * What to do with the zone's catch-all rule. Email Routing has one catch-all per zone (a
 * subdomain has none of its own), so it also catches unmatched mail to the zone's other
 * routed addresses. It is pointed at the inbox only when it is off or drops mail, or when
 * `--replace-catch-all` says so; an existing forward or another Worker is never replaced
 * silently.
 */
export function catchAllPlan(
  current: CatchAllRule | null,
  worker: string,
  replace: boolean
): CatchAllPlan {
  const action = current?.actions?.[0];
  if (
    current?.enabled &&
    action?.type === "worker" &&
    action.value?.includes(worker)
  ) {
    return { action: "keep", reason: `already sends to ${worker}` };
  }
  if (!current?.enabled || !action || action.type === "drop") {
    return {
      action: "set",
      reason: current?.enabled ? "it drops mail today" : "it is off today",
    };
  }
  const target = `${action.type}${action.value?.length ? ` ${action.value.join(", ")}` : ""}`;
  if (replace) {
    return {
      action: "set",
      reason: `--replace-catch-all: it was ${target}`,
    };
  }
  return {
    action: "conflict",
    reason: `the zone's catch-all is enabled and goes to ${target}; pointing it at ${worker} would take that mail too. Re-run with --replace-catch-all if that is what you want (the inbox rejects mail outside the QA domain).`,
  };
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
