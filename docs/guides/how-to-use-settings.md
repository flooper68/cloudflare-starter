# Account and workspace settings

Use when changing personal preferences, managing sessions or adding a settings section. Open **Settings** in the app sidebar. `/app/profile` redirects to `/app/settings/account`.

## Pages and extensions

- **Account** (`/app/settings/account`): display name, custom avatar and verified email changes.
- **Appearance & language** (`/app/settings/appearance`): system/light/dark theme, IANA time zone and supported locale. Defaults are system, UTC and en. Values are validated with Intl; server-rendered `data-theme` avoids a flash of the wrong theme. `useFormatters` uses the saved locale/time zone for dates and numbers.
- **Security** (`/app/settings/security`): change password (revokes other sessions), link/unlink Google when configured, and list/sign out sessions. Linked accounts must use the same email and the last sign-in method cannot be unlinked.
- **Workspace** (`/app/settings/workspace`): members can read the name/logo; `workspace.manage` allows owners to change them. `workspace.delete` allows owners to delete a shared workspace only in multi mode, after typing its exact current name. Personal and single-mode workspaces cannot be deleted this way.
- **Privacy** (`/app/settings/privacy`): self-delete with explicit email confirmation in the UI and Better Auth's password or fresh-session check (15 minutes). Last-owner checks run before deleting anything; transfer ownership first when others still use a shared workspace.

The `settingsSections` array in `apps/web/src/components/settings/sections.ts` defines account/workspace grouping and visibility. Add a route to `settingsRoutes` in `routes.tsx`, under exported `settingsLayoutRoute`. Visibility is navigation only: the server still checks authorization. Account settings work even when the person has no workspace. Security and privacy pages are extension points for the corresponding features.

## Authentication and session credentials

Better Auth owns profile name, password, verified email changes, account linking and deletion. Email change is enabled without unverified bypass: a verified address first receives a confirmation and the new address must be verified. `/change-email` is an `EMAIL_LINK_PATHS` entry: a deployed app without outgoing email answers 412, while local development may log the link. It is limited to three requests per minute; deletion to three per hour. No new environment variable, secret or binding is needed.

Own session procedures return opaque ids, device/IP, creation/expiry and whether the browser is current. Tokens never reach the UI, MCP or audit metadata. `revokeAccountSession` selects by session id **and** current user before passing the token to `AccountAuthGateway`. The browser adapter calls `auth.api.revokeSession`; MCP has an OAuth token rather than a cookie, so its adapter uses Better Auth's internal `deleteSession`, like the existing admin gateway. Recheck this adapter when upgrading Better Auth. Cookie-cached sessions may persist for at most the configured 60 seconds; sensitive auth calls bypass that cache.

## Images and storage

`user_settings` is user-scoped (foreign key cascades on account deletion), separate from generated Better Auth tables. It stores theme, timezone, locale and the current `avatar_key`. `workspaces.logo_key` stores the current logo. Regenerate the starter's single `0000_init` and recreate only local D1 when moving from the old schema; deployed projects use additive migrations (see [D1 guide](how-to-setup-d1.md)).

Image uploads stream through a 1 MB cap and require a PNG/JPEG/WebP signature matching the declared MIME type. SVG and mismatched files are refused. Uploads require a same-origin request, authentication and the existing `upload.user` limit. Workspace logo writes additionally require ownership. R2 keys are `users/<userId>/avatar/<uuid>` and `workspaces/<workspaceId>/logo/<uuid>`; callers never supply keys. Current versions are served only after ownership/membership checks with `private, max-age=31536000, immutable` and `nosniff`. Old URLs stop resolving at the server once replaced; already cached private copies retain their cache lifetime.

Routes: `POST /api/account/avatar`, `GET /api/account/avatar/<version>`, `POST /api/workspaces/<workspaceId>/logo`, `GET /api/workspaces/<workspaceId>/logo/<version>`. A replacement uploads first, publishes its reference, audits and deletes the previous object. A failed deletion or concurrent replacement can leave an unreferenced version, which the optional storage reconciler detects through `findReferencedAvatarKeys` / `findReferencedLogoKeys`. Account/workspace erasure purges all image versions under that exact owner's prefix. Custom avatars do not overwrite the provider's image; removing one restores the provider image when available.

## APIs and agent tools

| tRPC                                          | MCP                                                                                       |
| --------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `account.settings.get/update`                 | `get_account_settings`, `update_account_settings`                                         |
| `account.sessions.list/revoke`                | `list_sessions`, `revoke_session`                                                         |
| `account.removeAvatar`                        | `remove_avatar`                                                                           |
| `workspace.settings/update/delete/removeLogo` | `get_workspace_settings`, `update_workspace`, `delete_workspace`, `remove_workspace_logo` |

Binary image transfer and Better Auth credential flows stay on their authenticated HTTP routes and have reasoned MCP parity entries. Session revocation and workspace deletion are destructive tools: ask the person before calling. Settings, image and workspace mutations record audit events without credential or image contents.

## Verification

Domain tests cover Intl parameters, image signatures and workspace permissions. D1/R2 tests cover private ownership, replacements, deletion guards and references. `apps/web/test/api/settings.test.ts` exercises tRPC, the cookie and MCP-compatible session adapters, binary routes, cross-workspace denial and fresh self-deletion. The browser journeys cover account/profile/avatar/preferences/security and workspace cleanup, with screenshots captured outside the repository. Run narrow tests, `bun run verify`, `bun run build`, component tests and E2E before shipping.

Avatar and logo upload refusals use the common HTTP rate-limit response: 429 Problem Details with Retry-After, RateLimit and RateLimit-Policy. Concurrent replacement tests release two real R2 writes in both publication orders and verify the final image and other owners remain intact. Removing a custom avatar reloads the bootstrap so the provider image returns consistently in the page and shell.
