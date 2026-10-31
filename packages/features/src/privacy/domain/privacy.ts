import { z } from "zod";
import { DomainError, defineJob, defineNotification, html } from "../../kernel";
export const EXPORT_TTL_MS = 24 * 60 * 60 * 1000;
export const EXPORT_LEASE_MS = 20 * 60 * 1000;
export const EXPORT_PAGE_SIZE = 10;
export const EXPORT_MAX_BYTES = 1024 * 1024 * 1024;
export const EXPORT_MAX_ENTRIES = 10000;
export const dataExportJob = defineJob({
  type: "privacy.build-export",
  payload: z.object({ requestId: z.uuid() }).strict(),
  backoff: { initialDelaySeconds: 60, maxDelaySeconds: 3600, jitter: "equal" },
});
export const purgeDataExportsJob = defineJob({
  type: "privacy.purge-exports",
  payload: z.object({ asOf: z.iso.datetime() }).strict(),
  backoff: { initialDelaySeconds: 60, maxDelaySeconds: 3600, jitter: "equal" },
});
export const exportReadyNotification = defineNotification({
  type: "privacy.export-ready",
  label: "Your data export is ready",
  data: z
    .object({
      requestId: z.uuid(),
      href: z.string().startsWith("/api/privacy/exports/"),
    })
    .strict(),
  defaultChannels: { inApp: true, email: true },
  securityCritical: true,
  render(data, ctx) {
    const url = `${ctx.appUrl}${data.href}`;
    return {
      inApp: {
        title: "Your data export is ready",
        body: "Download it within 24 hours while signed in.",
        href: data.href,
      },
      email: {
        subject: "Your data export is ready",
        text: `Export ${data.requestId} is ready. Download within 24 hours: ${url}`,
        html: String(
          html`<p>Your data export is ready. <a href="${url}">Download your data</a> within 24 hours.</p>`
        ),
      },
    };
  },
});
export class ExportUnavailableError extends DomainError {
  constructor() {
    super(
      "not_found",
      "Data export is unavailable or expired",
      "EXPORT_UNAVAILABLE"
    );
  }
}
export class ExportLimitError extends DomainError {
  constructor() {
    super(
      "rate_limited",
      "One active export and at most three requests per 24 hours are allowed",
      "EXPORT_LIMIT"
    );
  }
}
export class ExportLockedError extends DomainError {
  constructor() {
    super("unavailable", "The export is already being built", "EXPORT_LOCKED");
  }
}
export class ExportSizeError extends DomainError {
  constructor() {
    super(
      "invalid_input",
      "The export exceeds the supported archive size or entry count",
      "EXPORT_TOO_LARGE"
    );
  }
}
export interface DataEntity {
  readonly table: string;
  readonly scope: "user" | "workspace" | "platform";
  readonly columns: readonly string[];
  readonly userColumn?: string;
  readonly workspaceColumn?: string;
  readonly userMode?:
    | "own"
    | "personal-workspaces"
    | "own-files"
    | "audit"
    | "invitations";
  readonly erase:
    | "auth-cascade"
    | "user-cascade"
    | "workspace-cascade"
    | "audit-redaction"
    | "privacy-cleanup"
    | "retain-platform";
  readonly reason: string;
  readonly optional?: boolean;
}
export interface ExportSubject {
  readonly userId: string;
  readonly scope: "user" | "workspace";
  readonly workspaceId: string | null;
}
