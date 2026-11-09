# How to send notifications

::reviewed{date="2026-11-09"}

A feature tells people that something happened with one call: the inbox, email (at once or in a daily digest), each person's preferences and one-click unsubscribe are handled for it. Use this guide to add a notification type and send it. What people see: [Notifications](../features/notifications.md); every type: [Catalogs › Notifications](../reference/catalogs.md#notifications).

::flow[Use case -> notify -> Dispatch job -> Inbox, email now or in the digest]{title="Notification flow: a use case calls notify, a job writes the inbox entry and sends email at once or in the daily digest"}

## Add a notification type

:::steps
1. **Declare it** in the owning feature's domain with `defineNotification({ type, label, data, defaultChannels, securityCritical, render })`. `render` returns the in-app text and the email; the kernel's `html` tag escapes every value.
2. **List it** in `packages/features/src/notification-catalog.ts`, in the order of the preferences screen.
3. **Send it** from the use case after the change succeeded: `await deps.notify(definition, { recipients, data, context })`.
4. **Test it**: `render` (including escaping) and the data schema; in the producer's test, assert it with `notificationsSent(deps.jobQueue)`.
   :::

:::prompt{title="Paste this into your coding agent"}
```text
Add a notification "<feature>.<name>" that tells <who> when <what happens>, in the app and
by email by default. Declare it, add it to the catalog, send it from <use case>, and add the
tests. Follow docs/guides/how-to-send-notifications.md.
```
:::

:::decision{title="Why notify instead of a hand-written mail"}
People's preferences, the digest, unsubscribe and retention apply only to notifications. The review checklist asks for `notify` for any user-facing event.
:::

:::gotcha{title="Keep data small and free of secrets"}
It is stored on the inbox row and rendered every time the inbox is read, so wording changes apply to old entries too. At most 500 recipients per call.
:::

:::gotcha{title="The actor is not notified"}
`notify` drops the person who acted, except for security notices, where they are exactly who to warn.
:::

## Reference

How it fits together, channels and cadence, producers today, email headers and unsubscribe, the digest, retention, metrics, audit, the inbox in the app and common problems: [Notifications reference](../reference/notifications.md).
