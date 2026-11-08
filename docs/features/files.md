# File storage

::reviewed{date="2026-11-08"}

Let people upload files to their workspace and get them back, through the app or straight to storage with a signed link. Deleted files go to the trash first, and plan limits apply to storage and uploads.

::video{id="platform" poster="upload-demo" title="App platform in 75 seconds"}

## Where to find it

::shot{id="upload-demo" alt="The file upload demo: through the app or straight to storage"}

## How it works

::flow[Upload -> Workspace check -> File storage -> Download for members only]{title="File flow: an upload is checked against the workspace, stored, and only the workspace's members can download it"}

- **Through the app**: the browser sends the file to your app, which checks access on every read. No keys needed, works locally with nothing to set up.
- **Straight to storage**: the app signs a short-lived link and the browser uploads directly. Good for large files; needs an access key and CORS on the bucket.
- Both share one table, one 10 MB limit and one rule: a file belongs to a workspace; everyone else gets "not found".

## Turn it on

Uploads through the app work out of the box. Signed links need storage credentials:

:::settings
- R2_ACCOUNT_ID = none Your Cloudflare account id
- R2_ACCESS_KEY_ID = none An access key limited to the files bucket
- R2_SECRET_ACCESS_KEY = none Its secret
- R2_FILES_BUCKET_NAME = none The bucket's name

:::

:::prompt{title="Paste this into your coding agent"}
```text
Set up signed upload links for develop: run `bun run setup:storage --env develop`,
walk me through creating the access key it asks for, and set CORS on the bucket.
```
:::

:::byhand
The six steps (bucket, account id, token, local values, secrets, CORS) are in [Set up storage](../reference/storage.md#presigned-urls).
:::

## Use it

:::tabs
```bash title="curl"
# Through the app (signed-in session cookie)
curl -X POST "https://<your-app>/api/files" -b cookies.txt -F file=@brief.txt
```
```ts title="API"
const files = await trpc.storage.listFiles.query({});
```
```json title="MCP"
{ "method": "tools/call", "params": { "name": "list_files", "arguments": {} } }
```
:::

:::gotcha{title="A signed download link outlives the trash"}
A link issued before a file was deleted keeps working until it expires (one hour): storage checks only its signature. New links are refused at once.
:::

## Limits

- 10 MB per file; storage and monthly uploads count against the plan.
- Orphaned objects can be reported or removed by a daily check ([storage reconciliation](../reference/trash.md#optional-storage-reconciliation)).

## Related

- [Set up storage](../guides/how-to-setup-r2.md)
- [Export, delete, restore](privacy.md)
- [Plans and usage limits](billing.md)
