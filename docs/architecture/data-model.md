# Data model

The D1 tables grouped by the feature that owns them, with the foreign keys that matter for tenancy and deletion. Use when you add a table, trace what a user or workspace deletion removes, or look for the table behind a feature.

## Tables by feature

```mermaid
flowchart LR
  accTitle: D1 tables by feature
  accDescr: Two tables anchor everything. user (Better Auth) owns its sessions, accounts, second factors, passkeys, settings, OAuth clients and consents, notification preferences and settings, all deleted with it. workspaces own their members, invitations, subscription, add-ons, entitlement overrides, usage counters, notes, files and notifications, all deleted with the workspace. workspace_members joins users to workspaces with a role. note_comments belong to notes. feature_flag_rules belong to feature_flags. audit_events, job_idempotency_keys, data_requests, erasure_records, privacy_erasure_lock and pending_file_cleanup have no foreign keys, so they survive the deletions they record.

  subgraph Auth["accounts: Better Auth"]
    User["user"]
    Creds["session, account, two_factor, passkey"]
    OAuth["oauth_client, oauth_consent, oauth_access_token, oauth_refresh_token"]
    Settings["user_settings"]
  end

  subgraph Tenancy["workspaces"]
    Workspaces["workspaces"]
    Members["workspace_members"]
    Invitations["workspace_invitations"]
  end

  subgraph Billing["billing"]
    Plans["workspace_subscription, workspace_addon, entitlement_override, usage_counter"]
  end

  subgraph Notes["notes"]
    NotesT["notes"]
    Comments["note_comments"]
  end

  subgraph Files["files"]
    FilesT["files"]
    Pending["pending_file_cleanup"]
  end

  subgraph Notifications["notifications"]
    Inbox["notifications"]
    Prefs["notification_preferences, notification_settings"]
  end

  subgraph Platform["audit, jobs, privacy"]
    Audit["audit_events"]
    Jobs["job_idempotency_keys"]
    Privacy["data_requests, erasure_records, privacy_erasure_lock"]
  end

  subgraph Flags["feature flags"]
    FlagsT["feature_flags"]
    Rules["feature_flag_rules"]
  end

  User -->|user_id| Creds
  User -->|user_id| OAuth
  User -->|user_id| Settings
  User -->|user_id| Members
  Workspaces -->|workspace_id| Members
  Workspaces -->|workspace_id| Invitations
  Workspaces -->|workspace_id| Plans
  Workspaces -->|workspace_id| NotesT
  NotesT -->|note_id| Comments
  Workspaces -->|workspace_id| FilesT
  Workspaces -->|workspace_id| Inbox
  User -->|user_id| Inbox
  User -->|user_id| Prefs
  FlagsT -->|flag_key| Rules
```

Every arrow is a foreign key with `ON DELETE CASCADE`: deleting a workspace removes its rows, deleting a user removes their credentials, memberships and preferences. Authorship columns (`created_by`, `updated_by`, `deleted_by`, `invited_by`) point at `user` with `ON DELETE SET NULL` and are left out of the diagram. The tables in "audit, jobs, privacy" and `pending_file_cleanup` have no foreign keys on purpose: they record or finish work after a deletion. Not shown: Better Auth's `verification`, `jwks`, `rate_limit`, `oauth_resource`, `oauth_client_resource` and `oauth_client_assertion`.

The tables are defined in each feature's `*.schema.ts` (for example [notes.schema.ts](../../packages/features/src/notes/notes.schema.ts)), collected in [database.ts](../../packages/features/src/database.ts) and generated into [migrations/](../../packages/features/migrations/). The `workspace_id` rule and its exemptions: [Tenancy and authorization](overview.md#tenancy-and-authorization), `test/architecture/workspace-scope.test.ts`. What each table exports and how it is erased: [data-catalog.ts](../../packages/features/src/data-catalog.ts), [how-to-handle-data-privacy.md](../guides/how-to-handle-data-privacy.md). Changing the schema: [how-to-setup-d1.md](../guides/how-to-setup-d1.md).
