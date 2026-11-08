# Data exports and account erasure

::reviewed{date="2026-11-09"}

People export their data and delete their account themselves; admins handle the rest from the portal. Use this guide when you add persisted data (every table declares how it is exported and erased), handle an export or deletion request, or restore a database after an erasure. These are product capabilities, not a claim of legal compliance for your app. What people see: [Export, delete, restore and audit](../features/privacy.md).

::flow[Request -> Background job builds the ZIP -> Notification with a signed link -> Download within 24 hours]{title="Export flow: a request starts a background job that builds the archive; a notification brings a signed link that works for 24 hours"}

::shot{id="settings-privacy" alt="Settings › Privacy: export your data or delete your account"}

## When you add data

:::steps
1. **A new table?** Declare its export columns, scope and erasure treatment in `DATA_CATALOG`; the architecture tests fail until you do.
2. **Objects in file storage?** Extend `buildErasureHandlers`: a foreign-key cascade never removes an object.
3. **Deployed?** Set the export expiry rule on the bucket once: `bun run setup:privacy-storage --env <env> --dry-run`, then for real.
   :::

:::prompt{title="Paste this into your coding agent"}
```text
I added the <table> table. Register it in DATA_CATALOG with its export columns, scope
and erasure treatment, extend buildErasureHandlers if it stores objects, and run the
privacy architecture tests. Follow docs/guides/how-to-handle-data-privacy.md.
```
:::

## Handle a request

- **Export:** the person uses Settings › Privacy; an admin can request one for them in **Admin › Data requests**, delivered to them, never to the admin.
- **Deletion:** the person deletes their account in Settings › Privacy; an admin erases one from the user's page, in the browser, after a fresh sign-in.

:::decision{title="Why erasure is browser-only"}
Permanent erasure needs a fresh sign-in and the configured second factor, so it has no agent tool.
:::

:::gotcha{title="After a database restore, re-apply erasures"}
A point-in-time restore brings erased people back. The erasure ledger keeps their ids so you can erase them again ([erasure and retained data](../reference/data-privacy.md#erasure-and-retained-data)).
:::

## Reference

The flows in full, implementation and limits, storage expiry, retained data, why it is built this way, and uploads in flight during an erasure: [Data privacy reference](../reference/data-privacy.md).
