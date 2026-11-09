# Account and workspace settings

::reviewed{date="2026-11-09"}

People manage their profile, appearance, security, connected agents, privacy and their workspace in Settings. Use this guide to find a setting or add a settings section. What people see: [Sign-in, passkeys and two-factor](../features/accounts.md) and [Workspaces](../features/workspaces.md).

::shot{id="settings-account" alt="Settings › Account: profile, avatar and email"}

| Section               | What people do there                                                        |
| --------------------- | --------------------------------------------------------------------------- |
| Account               | Name, avatar, a verified email change                                       |
| Appearance & language | Theme, time zone and language                                               |
| Security              | Password, Google link, sessions, authenticator, recovery codes and passkeys |
| Connected agents      | See every agent they allowed and disconnect one                             |
| Privacy               | Export their data (owners: the workspace's), delete their account           |
| Workspace (owners)    | Name, logo, delete a shared workspace after typing its name                 |

Open them from **Settings** in the sidebar or the profile menu; **Workspace settings** is in the workspace menu.

## Add a settings section

:::steps
1. **Add the page** and its route under `apps/web/src/components/settings/`.
2. **Add an entry** to `settingsSections` in `apps/web/src/components/settings/sections.ts`: its group (account or workspace), label, palette keywords and who sees it. The settings menu, the top bar and the command palette read it.
3. **Expose its procedures as tools** and record audit events for its changes.
   :::

:::prompt{title="Paste this into your coding agent"}
```text
Add a "<name>" section to Settings for <what it does>: page, route, settingsSections entry,
procedures with MCP tools and audit events, and tests. Follow docs/guides/how-to-use-settings.md.
```
:::

:::gotcha{title="Images are checked by their bytes"}
Avatars and logos stream through a 1 MB cap and must be PNG, JPEG or WebP by signature; SVG is refused.
:::

:::decision{title="Credentials never reach the screen or an agent"}
Session lists show opaque ids and devices, never tokens. Disconnecting an agent, signing out a session and deleting a workspace are destructive tools: agents ask first.
:::

## Reference

Authentication and session credentials, images and storage, APIs and agent tools, and verification: [Settings pages reference](../reference/settings-pages.md).
