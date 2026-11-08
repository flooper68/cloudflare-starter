# Agent tools

::reviewed{date="2026-11-08"}

Every tool an agent can call at `<APP_URL>/mcp`, generated from the tool registry (`apps/web/src/server/mcp/tools.ts`) by `bun run docs:reference`, so it always matches the code. A tool acts as the signed-in person, in their current workspace unless it is given a `workspaceId`. **Outward** tools send something outside the app and **destructive** ones remove access or data: agents are told to ask first. How agents connect: [Let agents use your app](../features/agents.md); adding a tool: [the MCP guide](../guides/how-to-setup-mcp.md).

<!-- generated:agent-tools -->

### Everyone

| Tool                              | Does                            | Kind               | Procedures                                        |
| --------------------------------- | ------------------------------- | ------------------ | ------------------------------------------------- |
| `accept_invitation`               | Accept invitation               | write              | `workspace.invitations.accept`                    |
| `add_note_comment`                | Comment on note                 | write              | `notes.comments.add`                              |
| `archive_notifications`           | Archive notifications           | write              | `notifications.archive`                           |
| `change_member_role`              | Change member role              | write              | `workspace.members.changeRole`                    |
| `create_note`                     | Create note                     | write              | `notes.create`                                    |
| `create_upload_url`               | Create upload URL               | write              | `storage.createUpload`                            |
| `create_workspace`                | Create workspace                | write              | `workspace.create`                                |
| `delete_file`                     | Move file to trash              | write              | `storage.deleteFile`                              |
| `delete_from_trash_permanently`   | Delete from trash permanently   | write, destructive | `trash.deletePermanently`                         |
| `delete_note`                     | Move note to trash              | write              | `notes.delete`                                    |
| `delete_workspace`                | Delete workspace                | write, destructive | `workspace.delete`                                |
| `disconnect_agent`                | Disconnect an agent             | write, destructive | `account.agents.disconnect`                       |
| `empty_trash`                     | Empty trash                     | write, destructive | `trash.empty`                                     |
| `enqueue_hello`                   | Enqueue hello                   | write              | `queue.enqueueHello`                              |
| `get_account_settings`            | Account settings                | read               | `account.settings.get`                            |
| `get_billing_portal_url`          | Get billing portal URL          | write, outward     | `workspace.billing.portalUrl`                     |
| `get_billing_summary`             | Get billing summary             | read               | `workspace.billing.summary`                       |
| `get_checkout_url`                | Get checkout URL                | write, outward     | `workspace.billing.checkoutUrl`                   |
| `get_client_flags`                | Get client feature flags        | read               | `flags.client`                                    |
| `get_data_export_download`        | Get export download link        | read               | `privacy.download`                                |
| `get_download_url`                | Get download URL                | read               | `storage.getDownloadUrl`                          |
| `get_note`                        | Get note                        | read               | `notes.get`                                       |
| `get_notification_preferences`    | Get notification preferences    | read               | `notifications.preferences.get`                   |
| `get_security_status`             | Security status                 | read               | `account.security.status`                         |
| `get_workspace_settings`          | Workspace settings              | read               | `workspace.settings`                              |
| `invite_member`                   | Invite member                   | write, outward     | `workspace.invitations.create`                    |
| `leave_workspace`                 | Leave workspace                 | write, destructive | `workspace.leave`                                 |
| `list_connected_agents`           | List connected agents           | read               | `account.agents.list`                             |
| `list_data_exports`               | List your data exports          | read               | `privacy.list`                                    |
| `list_files`                      | List files                      | read               | `storage.listFiles`                               |
| `list_invitations`                | List invitations                | read               | `workspace.invitations.list`                      |
| `list_members`                    | List members                    | read               | `workspace.members.list`                          |
| `list_notes`                      | List notes                      | read               | `notes.list`                                      |
| `list_notifications`              | List notifications              | read               | `notifications.list`, `notifications.unreadCount` |
| `list_sessions`                   | List sessions                   | read               | `account.sessions.list`                           |
| `list_trash`                      | List trash                      | read               | `trash.list`                                      |
| `list_workspaces`                 | List workspaces                 | read               | `workspace.list`                                  |
| `mark_notifications_read`         | Mark notifications read         | write              | `notifications.markRead`                          |
| `ping`                            | Ping                            | read               | `public.hello`                                    |
| `preview_invitation`              | Preview invitation              | read               | `workspace.invitations.preview`                   |
| `remove_avatar`                   | Remove avatar                   | write              | `account.removeAvatar`                            |
| `remove_member`                   | Remove member                   | write, destructive | `workspace.members.remove`                        |
| `remove_workspace_logo`           | Remove workspace logo           | write              | `workspace.removeLogo`                            |
| `request_data_export`             | Request a data export           | write              | `privacy.requestExport`                           |
| `restore_from_trash`              | Restore from trash              | write              | `trash.restore`                                   |
| `revoke_invitation`               | Revoke invitation               | write, destructive | `workspace.invitations.revoke`                    |
| `revoke_session`                  | Sign out a session              | write, destructive | `account.sessions.revoke`                         |
| `search_notes`                    | Search notes                    | read               | `notes.search`                                    |
| `send_test_email`                 | Send test email                 | write, outward     | `email.sendTest`                                  |
| `switch_workspace`                | Switch workspace                | write              | `workspace.switch`                                |
| `transfer_ownership`              | Transfer ownership              | write              | `workspace.transferOwnership`                     |
| `update_account_settings`         | Update account settings         | write              | `account.settings.update`                         |
| `update_note`                     | Update note                     | write              | `notes.update`                                    |
| `update_notification_preferences` | Update notification preferences | write              | `notifications.preferences.update`                |
| `update_workspace`                | Update workspace                | write              | `workspace.update`                                |
| `whoami`                          | Who am I                        | read               | `health.hello`                                    |

### Admin (platform admins only)

| Tool                           | Does                            | Kind               | Procedures                      |
| ------------------------------ | ------------------------------- | ------------------ | ------------------------------- |
| `admin_assign_plan`            | Admin: assign plan              | write              | `admin.billing.assignPlan`      |
| `admin_assign_workspace_owner` | Admin: assign workspace owner   | write, destructive | `admin.workspaces.assignOwner`  |
| `admin_ban_user`               | Admin: suspend user             | write, destructive | `admin.users.ban`               |
| `admin_delete_storage_orphans` | Delete dangling storage         | write, destructive | `admin.storage.deleteOrphans`   |
| `admin_delete_workspace`       | Admin: delete workspace         | write, destructive | `admin.workspaces.delete`       |
| `admin_get_health`             | Admin: health                   | read               | `admin.health.get`              |
| `admin_get_overview`           | Admin: overview                 | read               | `admin.overview.get`            |
| `admin_get_settings`           | Admin: deployment settings      | read               | `admin.settings.get`            |
| `admin_get_user`               | Admin: user detail              | read               | `admin.users.get`               |
| `admin_get_workspace`          | Admin: workspace detail         | read               | `admin.workspaces.get`          |
| `admin_get_workspace_billing`  | Admin: get workspace billing    | read               | `admin.billing.get`             |
| `admin_get_workspace_usage`    | Admin: get workspace usage      | read               | `admin.billing.usage`           |
| `admin_list_audit_events`      | Admin: audit log                | read               | `admin.audit.list`              |
| `admin_list_data_requests`     | List data requests              | read               | `admin.privacy.list`            |
| `admin_list_users`             | Admin: list users               | read               | `admin.users.list`              |
| `admin_list_workspaces`        | Admin: list workspaces          | read               | `admin.workspaces.list`         |
| `admin_reconcile_storage`      | Inspect dangling storage        | write              | `admin.storage.reconcile`       |
| `admin_request_data_export`    | Request a user's data export    | write              | `admin.privacy.requestExport`   |
| `admin_revoke_user_sessions`   | Admin: sign user out            | write, destructive | `admin.users.revokeSessions`    |
| `admin_send_password_reset`    | Admin: send password reset      | write, outward     | `admin.users.sendPasswordReset` |
| `admin_send_test_email`        | Admin: send test email          | write, outward     | `admin.email.sendTest`          |
| `admin_set_addons`             | Admin: set add-ons              | write              | `admin.billing.setAddons`       |
| `admin_set_override`           | Admin: set entitlement override | write              | `admin.billing.setOverride`     |
| `admin_set_user_role`          | Admin: set platform role        | write, destructive | `admin.users.setRole`           |
| `admin_storage_status`         | Storage maintenance settings    | read               | `admin.storage.status`          |
| `admin_unban_user`             | Admin: lift suspension          | write              | `admin.users.unban`             |
| `list_feature_flags`           | List feature flags              | read               | `admin.flags.list`              |
| `set_feature_flag_rules`       | Set feature flag rules          | write              | `admin.flags.setRules`          |
| `update_feature_flag`          | Update feature flag             | write              | `admin.flags.update`            |

<!-- /generated:agent-tools -->

## Procedures without a tool

The parity test (`apps/web/src/server/mcp/parity.test.ts`) fails when a procedure has neither a tool nor an entry here with a reason. A new exemption is a design decision: it needs a reason a reviewer would accept.

<!-- generated:agent-tool-exemptions -->

| Procedure                       | Why it has no tool                                                                                                |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `admin.users.resetSecondFactor` | Recovery resets authentication and is deliberately browser-only with fresh administrator assurance.               |
| `admin.users.remove`            | Legacy web alias of privacy.eraseUser; permanent erasure requires an interactive browser with fresh assurance.    |
| `admin.privacy.eraseUser`       | Permanent account erasure requires an interactive administrator with fresh second-factor assurance; browser only. |
| `analytics.track`               | client telemetry, not an agent capability                                                                         |
| `admin.impersonation.start`     | creates a browser cookie session; an MCP client has no browser session to swap                                    |
| `admin.impersonation.stop`      | creates a browser cookie session (restores the admin's); only an impersonated browser session can call it         |

<!-- /generated:agent-tool-exemptions -->
