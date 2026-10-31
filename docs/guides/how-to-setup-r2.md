# How To Setup R2 Storage

The web app can reach R2 two ways. Both are wired up and share the same `files` table, key layout (`workspaces/{workspaceId}/uploads/{yyyy}/{mm}/{fileId}`), 10 MB limit and access rule (a file belongs to a workspace; its members may read and upload, everyone else gets 404), so a feature picks the one that fits and the other can be deleted. The routes take `?workspaceId=` (else the user's current workspace); a presigned URL is signed only after the file was found in the caller's workspace. Deleting a workspace's data removes its objects with `deleteWorkspaceFiles`. Deleting a file moves it to the workspace's trash: the object stays in R2 until it is restored or purged ([how-to-use-trash.md](how-to-use-trash.md)).

|             | Binding (`env.FILES`)                                                            | Presigned URL (S3 API)                                                   |
| ----------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Bytes flow  | Browser → Worker → R2                                                            | Browser → R2 directly                                                    |
| Credentials | None, the binding is the permission                                              | R2 access key pair as secrets                                            |
| Auth check  | On every read, in the Worker                                                     | Once, when the URL is signed; the URL is a bearer token until it expires |
| Local dev   | Simulated, no setup                                                              | Talks to the real bucket                                                 |
| CORS        | Not needed                                                                       | Needed on the bucket                                                     |
| Good for    | Server-written files, small uploads, anything behind auth                        | Large uploads, links handed to someone outside the app                   |
| Code        | `storeFile`, `readWorkspaceFile`; routes `POST /api/files`, `GET /api/files/:id` | `createPresignedUpload`, `createDownloadUrl`; tRPC `storage.*`           |

Both live in the [files feature](../../packages/features/src/files/index.ts). `/app/upload-demo` shows them side by side.

Official references:

- [R2 Workers API (binding)](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)
- [R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [R2 S3-compatible API tokens](https://developers.cloudflare.com/r2/api/tokens/)

## Binding: Local Dev

Nothing to do. `bun run dev:web` simulates `FILES` under `apps/web/.wrangler/state`.

## Binding: Deployed

Create one bucket per environment, matching `r2_buckets` in [apps/web/wrangler.jsonc](../../apps/web/wrangler.jsonc):

```bash
bunx wrangler r2 bucket create cloudflare-starter-files-develop
bunx wrangler r2 bucket create cloudflare-starter-files-staging
bunx wrangler r2 bucket create cloudflare-starter-files-production
```

Add `--jurisdiction eu` if the data must stay in the EU, and set the same `jurisdiction` on the binding.

## Presigned URLs

Only needed if a feature uses the direct path. Use the same bucket as the binding of that environment, so files written either way are readable either way. In local dev the binding is simulated but presigned URLs hit the real bucket, so the two do not see each other's files locally.

### Step 1: Pick The Bucket

Use the environment's binding bucket (above), e.g. `cloudflare-starter-files-develop`. For local dev of the presigned path that is a real remote bucket.

### Step 2: Find Your Account ID

You need this for `R2_ACCOUNT_ID`.

- Dashboard: open any R2 bucket page. The account ID is shown in the sidebar and in the S3 endpoint `https://<account-id>.r2.cloudflarestorage.com`.
- CLI: `bunx wrangler whoami` lists the account ID.

### Step 3: Create An R2 API Token

The app signs S3 requests with an access key pair — **not** a Cloudflare API token.

1. Open the Cloudflare dashboard → **R2** → **Manage R2 API Tokens** → **Create API token**.
2. Permission: **Object Read & Write**.
3. Specify **Apply to specific buckets only** and select the bucket you created.
4. Choose a TTL appropriate for your environment (for long-lived deployments, leave TTL unset).
5. Submit. Cloudflare will display:
   - **Access Key ID** → `R2_ACCESS_KEY_ID`
   - **Secret Access Key** → `R2_SECRET_ACCESS_KEY`

Important:

- The secret is shown **once**. Copy it immediately. If you lose it, revoke the token and create a new one.
- Scope the token to the specific bucket. A broad account-wide token increases blast radius if the secret leaks.

### Step 4: Fill In Local Environment Values

Edit `apps/web/.dev.vars`:

```env
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_FILES_BUCKET_NAME=cloudflare-starter-files-develop
```

Start the app:

```bash
bun run dev:web
```

Open `http://localhost:4321/app/upload-demo` and use the right-hand card. Confirm it shows progress, a `fileId`, and a working signed download URL.

### Step 5: Set Secrets For Deployed Environments

From [apps/web](../../apps/web/README.md):

```bash
cd apps/web
bunx wrangler secret put R2_ACCOUNT_ID
bunx wrangler secret put R2_ACCESS_KEY_ID
bunx wrangler secret put R2_SECRET_ACCESS_KEY
bunx wrangler secret put R2_FILES_BUCKET_NAME
```

Repeat for `--env staging` and `--env production` as needed.

Set `R2_FILES_BUCKET_NAME` to that environment's bucket.

### Step 6: Configure CORS On The Bucket

Direct browser PUT to the presigned URL requires CORS on the R2 bucket.

From the Cloudflare dashboard → bucket → **Settings** → **CORS Policy**, add something like:

```json
[
  {
    "AllowedOrigins": ["https://your-web-host", "http://localhost:4321"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Adjust `AllowedOrigins` to match your deployed web hostname(s). Without this, the browser PUT will fail with a CORS error even though the signed URL is valid.

## Common Problems

### Upload Fails With A Signature Mismatch

Symptom:

- The browser PUT returns `403` with `SignatureDoesNotMatch`.

Fix:

- Confirm `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` match the pair shown when the token was created.
- Confirm `R2_ACCOUNT_ID` is the account that owns the bucket.
- Confirm the system clock on the device signing the request is correct — S3 signatures are time-sensitive.

### Upload Fails With CORS

Symptom:

- Browser console shows a CORS error on the PUT to `*.r2.cloudflarestorage.com`.

Fix:

- Add a CORS policy on the R2 bucket that allows your web origin and the `PUT`/`GET` methods. See Step 6.

### Presigned Card Returns A Configuration Error

Symptom:

- The presigned card on `/app/upload-demo` returns a precondition error before any upload starts. The binding card does not need these values.

Fix:

- All four `R2_*` variables must be set. Missing any of them disables the feature.
- After setting secrets on a deployed worker, redeploy for the new values to take effect.

### Download URL Returns 403 Or 404

Symptom:

- The signed download URL works briefly, then stops.

Fix:

- Presigned URLs expire after 3600 seconds by default. Request a new one.
- If the file was never uploaded successfully, the object will not exist. Re-upload.

## Quick Setup Checklist

Binding only:

1. `bunx wrangler r2 bucket create cloudflare-starter-files-<env>` per environment

Adding presigned URLs:

2. Create an R2 API token scoped to the bucket (Object Read & Write)
3. Fill `R2_*` in `apps/web/.dev.vars`; `bunx wrangler secret put R2_* --env <env>` for deploys
4. Add a CORS policy on the bucket for your web origin(s)

Profile avatars/logos use capped PNG/JPEG/WebP uploads, current-reference checks and private versioned reads under users/<id>/avatar/ and workspaces/<id>/logo/. See [settings](how-to-use-settings.md) for ownership, cleanup and reconciliation.

## Orphaned storage

Optional daily maintenance and on-demand admin reports use `STORAGE_RECONCILE=off|report|delete` (required; explicitly off in the starter). `bun run setup:storage --env all --dry-run` previews source configuration; `doctor` checks it. Start with a report; deletion is permanent and only touches registered application key shapes older than 24 hours with no live, trashed, avatar/logo or pending-upload reference. See [storage reconciliation](how-to-use-trash.md#optional-storage-reconciliation) for the cursor job, admin actions, audit results and safety contract.
