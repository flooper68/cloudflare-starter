// Every persisted table has an explicit export projection and erasure treatment.
import type { DataEntity } from "./privacy";
export const DATA_CATALOG: readonly DataEntity[] = [
  {
    table: "pending_file_cleanup",
    scope: "platform",
    columns: [],
    erase: "privacy-cleanup",
    reason:
      "Temporary exact-key/deleted-workspace/avatar-prefix cleanup intents survive erasure and queue outages; removed only after physical cleanup. Not user content or job history.",
  },
  {
    table: "privacy_erasure_lock",
    scope: "platform",
    columns: [],
    erase: "retain-platform",
    reason:
      "Short-lived serialization lease for account erasure, deleted on completion and expires after 20 minutes.",
  },
  {
    table: "user",
    scope: "user",
    columns: [
      "id",
      "name",
      "email",
      "email_verified",
      "image",
      "created_at",
      "updated_at",
      "role",
    ],
    userColumn: "id",
    erase: "auth-cascade",
    reason: "Own identity only; credentials are separately excluded.",
  },
  {
    table: "account",
    scope: "user",
    columns: ["id", "account_id", "provider_id", "created_at", "updated_at"],
    userColumn: "user_id",
    erase: "auth-cascade",
    reason: "Linked account metadata only; no passwords or provider tokens.",
  },
  {
    table: "session",
    scope: "user",
    columns: [
      "id",
      "created_at",
      "updated_at",
      "expires_at",
      "ip_address",
      "user_agent",
    ],
    userColumn: "user_id",
    erase: "auth-cascade",
    reason: "Own session metadata; never session tokens.",
  },
  {
    table: "user_settings",
    scope: "user",
    columns: ["theme", "timezone", "locale", "avatar_key"],
    userColumn: "user_id",
    erase: "user-cascade",
    reason: "Own preferences and current avatar reference.",
  },
  {
    table: "workspaces",
    scope: "workspace",
    columns: ["id", "name", "kind", "logo_key", "created_at"],
    workspaceColumn: "id",
    userMode: "personal-workspaces",
    erase: "workspace-cascade",
    reason:
      "User export includes personal workspaces; shared workspace content requires its owner's export.",
  },
  {
    table: "workspace_members",
    scope: "workspace",
    columns: [
      "workspace_id",
      "user_id",
      "role",
      "created_at",
      "last_active_at",
    ],
    workspaceColumn: "workspace_id",
    userColumn: "user_id",
    erase: "user-cascade",
    reason:
      "Own memberships; owner workspace export includes membership roster.",
  },
  {
    table: "workspace_invitations",
    scope: "workspace",
    columns: [
      "id",
      "workspace_id",
      "email",
      "role",
      "expires_at",
      "accepted_at",
      "revoked_at",
      "created_at",
    ],
    workspaceColumn: "workspace_id",
    userMode: "invitations",
    erase: "privacy-cleanup",
    reason:
      "Own invitations and sent invitations; token hashes never exported. Erasure removes invitations to the erased email.",
  },
  {
    table: "files",
    scope: "workspace",
    columns: [
      "id",
      "workspace_id",
      "r2_key",
      "filename",
      "content_type",
      "size_bytes",
      "created_by",
      "created_at",
      "deleted_at",
      "deleted_by",
    ],
    workspaceColumn: "workspace_id",
    userMode: "own-files",
    erase: "workspace-cascade",
    reason:
      "Own-file metadata in shared workspaces; bytes only for personal-workspace or authorized workspace export. Erasure purges files of deleted workspaces, keeps shared content with attribution nulled.",
  },
  ...[
    "workspace_subscription",
    "workspace_addon",
    "entitlement_override",
    "usage_counter",
  ].map((table) => ({
    table,
    scope: "workspace" as const,
    columns:
      (
        {
          workspace_subscription: [
            "workspace_id",
            "plan_id",
            "status",
            "period_start",
            "period_end",
            "trial_ends_at",
            "provider",
            "updated_at",
          ],
          workspace_addon: ["workspace_id", "addon_id", "quantity"],
          entitlement_override: [
            "workspace_id",
            "key",
            "kind",
            "enabled",
            "limit_value",
            "reason",
            "created_at",
          ],
          usage_counter: ["workspace_id", "metric", "period", "value"],
        } as Record<string, string[]>
      )[table] ?? [],
    workspaceColumn: "workspace_id",
    userMode: "personal-workspaces" as const,
    erase: "workspace-cascade" as const,
    reason:
      "Operational plan/usage state, not invoices or payment history; erase with deleted workspace. A future payment adapter must define its fiscal retention.",
  })),
  ...["notifications", "notification_preferences", "notification_settings"].map(
    (table) => ({
      table,
      scope: "user" as const,
      columns:
        (
          {
            notifications: [
              "id",
              "workspace_id",
              "type",
              "in_app",
              "email_state",
              "read_at",
              "archived_at",
              "created_at",
            ],
            notification_preferences: ["type", "channel", "enabled"],
            notification_settings: ["email_cadence"],
          } as Record<string, string[]>
        )[table] ?? [],
      userColumn: "user_id",
      erase: "user-cascade" as const,
      reason:
        "Own notification metadata/preferences; payloads can contain signed URLs and are excluded.",
    })
  ),
  {
    table: "audit_events",
    scope: "platform",
    columns: [
      "id",
      "occurred_at",
      "action",
      "outcome",
      "actor_user_id",
      "actor_kind",
      "target_type",
      "target_id",
      "workspace_id",
      "source",
    ],
    userMode: "audit",
    workspaceColumn: "workspace_id",
    erase: "audit-redaction",
    reason:
      "Own activity/target metadata; IP and email targets redacted on erasure, other actors' unrelated events retained for normal audit retention.",
  },
  {
    table: "oauth_client",
    scope: "user",
    columns: ["id", "client_id", "name", "created_at", "updated_at"],
    userColumn: "user_id",
    erase: "auth-cascade",
    reason: "Owned client metadata; never client secrets.",
  },
  {
    table: "oauth_consent",
    scope: "user",
    columns: ["id", "client_id", "scopes", "created_at", "updated_at"],
    userColumn: "user_id",
    erase: "auth-cascade",
    reason: "Own authorized clients and scopes.",
  },
  ...["oauth_access_token", "oauth_refresh_token"].map((table) => ({
    table,
    scope: "user" as const,
    columns: [],
    erase: "auth-cascade" as const,
    reason:
      "Credentials are never exportable; user foreign keys cascade on deletion.",
  })),
  {
    table: "verification",
    scope: "user",
    columns: [],
    erase: "privacy-cleanup",
    reason:
      "Verification secrets never exported; identifiers/values tied to erased id or email are deleted.",
  },
  ...[
    "jwks",
    "oauth_resource",
    "oauth_client_resource",
    "oauth_client_assertion",
    "rate_limit",
    "feature_flags",
    "feature_flag_rules",
    "job_idempotency_keys",
  ].map((table) => ({
    table,
    scope: "platform" as const,
    columns: [],
    erase: "retain-platform" as const,
    reason:
      "Deployment security/configuration or bounded operational state, not portable user data; normal retention applies. Signing keys and assertions never exported.",
  })),
  {
    table: "data_requests",
    scope: "user",
    columns: [
      "id",
      "scope",
      "subject_id",
      "status",
      "created_at",
      "expires_at",
      "size_bytes",
    ],
    userColumn: "user_id",
    erase: "privacy-cleanup",
    reason:
      "Export metadata only; prior exports and multipart uploads explicitly removed during erasure.",
  },
  {
    table: "erasure_records",
    scope: "platform",
    columns: [],
    erase: "retain-platform",
    reason:
      "Minimal user id and erasure timestamps retained to reapply deletion after backup/Time Travel restore; no email or payload.",
  },
  {
    table: "two_factor",
    scope: "user",
    columns: [],
    erase: "auth-cascade",
    optional: true,
    reason:
      "All factor secrets and backup codes excluded; user foreign key cascades.",
  },
  {
    table: "passkey",
    scope: "user",
    columns: [
      "id",
      "name",
      "created_at",
      "device_type",
      "backed_up",
      "transports",
      "aaguid",
    ],
    userColumn: "user_id",
    erase: "auth-cascade",
    optional: true,
    reason:
      "Passkey metadata only, no public key, credential id, counter or secrets.",
  },
];
