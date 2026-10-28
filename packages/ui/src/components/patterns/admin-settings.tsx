import { ExternalLink } from "lucide-react";

import { Badge } from "../badge";
import { Link } from "../link";
import { SettingsRow, SettingsSection } from "./settings-page";

export interface AdminSettingsData {
  readonly environment: string;
  readonly workspaceMode: "personal" | "single" | "multi";
  readonly signUp: "open" | "invite";
  readonly signUpDomains: readonly string[];
  readonly bootstrapAdminEmail: string | null;
  readonly signInMethods: readonly string[];
  readonly emailVerificationRequired: boolean;
  readonly emailEnabled: boolean;
  readonly adminPortal: "on" | "off";
}

export interface AdminSettingsProps {
  readonly settings: AdminSettingsData;
  /** Where background jobs are watched (Cloudflare dashboard); hidden when absent. */
  readonly queuesDashboardUrl?: string;
}

const MODE: Record<AdminSettingsData["workspaceMode"], string> = {
  personal: "Personal: everyone works in their own workspace",
  single: "Single: one workspace for the whole app",
  multi: "Multi: people create, join and switch workspaces",
};

const METHODS: Readonly<Record<string, string>> = {
  email_password: "Email + password",
  google: "Google",
};

const onOff = (on: boolean) => (
  <Badge tone={on ? "success" : "neutral"}>{on ? "On" : "Off"}</Badge>
);

/**
 * The deployment's settings, read-only: they change with `bun run setup:auth` and a
 * deploy, never from the portal. Background jobs are watched in Cloudflare's dashboard.
 */
export function AdminSettings({
  settings,
  queuesDashboardUrl,
}: AdminSettingsProps) {
  return (
    <div className="flex flex-col gap-6">
      <SettingsSection
        title="Workspaces and sign-up"
        description="Change with bun run setup:auth and deploy."
      >
        <SettingsRow label="Environment">
          <Badge tone="info">{settings.environment}</Badge>
        </SettingsRow>
        <SettingsRow label="Workspace mode">
          {MODE[settings.workspaceMode]}
        </SettingsRow>
        <SettingsRow label="Sign-up">
          {settings.signUp === "open" ? "Open to anyone" : "Invitation only"}
        </SettingsRow>
        <SettingsRow label="Allowed domains">
          {settings.signUpDomains.length
            ? settings.signUpDomains.join(", ")
            : "None"}
        </SettingsRow>
        <SettingsRow label="Bootstrap admin">
          {settings.bootstrapAdminEmail ?? "None"}
        </SettingsRow>
      </SettingsSection>
      <SettingsSection title="Sign-in">
        <SettingsRow label="Methods">
          {settings.signInMethods
            .map((method) => METHODS[method] ?? method)
            .join(", ")}
        </SettingsRow>
        <SettingsRow label="Email verification required">
          {onOff(settings.emailVerificationRequired)}
        </SettingsRow>
        <SettingsRow label="Email">{onOff(settings.emailEnabled)}</SettingsRow>
        <SettingsRow label="Admin portal">
          {onOff(settings.adminPortal === "on")}
        </SettingsRow>
      </SettingsSection>
      {queuesDashboardUrl ? (
        <SettingsSection
          title="Background jobs"
          description="Queue depth, retries and the dead-letter queue are in Cloudflare Queues metrics; job logs in Workers Logs."
        >
          <SettingsRow label="Cloudflare dashboard">
            <Link
              href={queuesDashboardUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1"
            >
              Open Queues
              <ExternalLink aria-hidden className="size-3.5" />
            </Link>
          </SettingsRow>
        </SettingsSection>
      ) : null}
    </div>
  );
}
