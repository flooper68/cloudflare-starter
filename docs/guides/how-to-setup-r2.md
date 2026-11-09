# How to set up R2 storage

::reviewed{date="2026-11-09"}

Files reach storage two ways: through the app (the binding; no keys, works locally with nothing to set up) or straight from the browser with a signed link (large uploads; needs an access key and CORS). Both share one table, one 10 MB limit and one rule: a file belongs to a workspace, everyone else gets "not found". Use this guide to set up either path. What people see: [File storage](../features/files.md).

::flow[Upload -> Workspace check -> File storage -> Download for members only]{title="File flow: an upload is checked against the workspace, stored, and only the workspace's members can download it"}

## Through the app (the binding)

Locally: nothing to do. Deployed: `bun run setup:cloudflare --env <env>` creates the bucket and writes it into `apps/web/wrangler.jsonc`.

## Signed links (optional)

:::settings
- R2_ACCOUNT_ID = none Your Cloudflare account id
- R2_ACCESS_KEY_ID = none An access key limited to the files bucket
- R2_SECRET_ACCESS_KEY = none Its secret
- R2_FILES_BUCKET_NAME = none The bucket's name
  :::

:::prompt{title="Paste this into your coding agent"}
```text
Set up signed upload links for <environment>: tell me how to create an R2 access key limited
to the files bucket, store the four R2_* values with setup:secrets, and set CORS on the
bucket for the app's origin. Ask before each change to my account.
```
:::

:::byhand
1. **Account id:** dashboard › R2 (right column), or `bunx wrangler whoami`.
2. **An R2 access key** (not a Cloudflare API token): R2 › Manage R2 API Tokens › Create, permission Object Read & Write, applied to the files bucket only. The secret is shown once.
3. **Values:** `bun run setup:secrets` (locally) and `--env <env>` for each deployed environment.
4. **CORS on the bucket** (bucket › Settings › CORS Policy): allow `PUT` and `GET` from the app's origins.

Each step in detail, with the CORS policy to paste: [presigned URLs](../reference/storage.md#presigned-urls).
:::

:::gotcha{title="A signed URL is a bearer token until it expires"}
The app checks access once, when it signs the URL. Keep expiries short; a link issued before a file was trashed works until it expires.
:::

:::decision{title="Two paths, pick one"}
The binding fits server-written files and small uploads; signed links fit large uploads. A feature picks one and the other can be deleted.
:::

## Reference

The two paths compared, the binding locally and deployed, every set-up step, common problems (signature mismatch, CORS, 403 or 404), the checklist and orphaned storage: [Storage reference](../reference/storage.md).
