# Notifications

::reviewed{date="2026-11-08"}

Tell people what happened, in the app and by email, the way they prefer: an inbox with an unread badge, a choice per type and channel, a daily digest, and one-click unsubscribe. Security notices always get through.

::video{id="platform" poster="notifications" title="App platform in 75 seconds"}

## Where to find it

::shot{id="notifications" alt="The notifications inbox"}

Each type can reach people in the app, by email, or both:

::shot{id="notification-preferences" alt="Notification preferences per type and channel"}

## How it works

::flow[Something happens -> Notify -> Inbox -> Email now or in the digest]{title="Notification flow: a feature notifies, a job writes the inbox entry, and email goes out at once or in the daily digest"}

- A feature calls `notify` with a type and recipients; a background job does the rest, so the action never waits for email.
- The person's preferences decide the channels; email goes out at once or in a digest at 08:00 UTC.
- New sign-ins, changed passwords and factors, and finished data exports are security notices: always in the app and by email, never in a digest.

## Turn it on

It is on. Email needs a sender ([Jobs and email](jobs-and-email.md)); without one, notifications still reach the inbox.

:::prompt{title="Paste this into your coding agent"}
```text
Add a notification type "notes.comment-added" that tells a note's author when someone
comments, in the app and by email by default. Follow docs/guides/how-to-send-notifications.md
and add it to the notification catalog with tests.
```
:::

## Use it

:::tabs
```text title="In the app"
The bell in the top bar      unread count, latest entries
Notifications                the inbox: mark read, archive
Notifications › Preferences  per type: in the app, by email; email now or daily
```
```ts title="API"
const inbox = await trpc.notifications.list.query({});
```
```json title="MCP"
{
  "method": "tools/call",
  "params": { "name": "list_notifications", "arguments": {} }
}
```
:::

:::decision{title="Why notifications go through a job"}
Sending happens after the action commits, with retries and no duplicates. A slow mail server never slows down the person who acted.
:::

:::gotcha{title="The actor is not notified"}
`notify` drops the person who acted from the recipients, except for security notices, where they are exactly who to warn.
:::

## Limits

- Read entries are kept 90 days, unread ones a year.
- A digest lists up to 90 entries.

## Related

- [Send notifications](../guides/how-to-send-notifications.md): add a type, digest timing, retention
- [Jobs and email](jobs-and-email.md)
- [Sign-in and two-factor](accounts.md): the security notices
