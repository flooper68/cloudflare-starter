# Storage reference

::reviewed{date="2026-11-09"}

The detail behind [the guide](../guides/how-to-setup-r2.md) on file storage: read it when the guide is not enough.

## Binding: Local Dev

Nothing to do. `bun run dev:web` simulates `FILES` under `apps/web/.wrangler/state`.

## Binding: Deployed

Create one bucket per environment, matching `r2_buckets` in [apps/web/wrangler.jsonc](../../apps/web/wrangler.jsonc):

```bash
bunx wrangler r2 bucket create cloudflare-starter-files-develop
bunx wrangler r2 bucket create cloudflare-starter-files-staging
bunx wrangler r2 bucket create cloudflare-starter-files-production
```

Add `--jurisdiction eu` if the data must stay in the EU, and set the same `jurisdiction` on the binding. `bun run setup:cloudflare --env <env> --jurisdiction eu` does both: it creates the bucket there and writes `"jurisdiction": "eu"` into the environment's `r2_buckets` entry (a jurisdictional bucket is invisible to a binding without it).

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

Profile avatars/logos use capped PNG/JPEG/WebP uploads, current-reference checks and private versioned reads under users/<id>/avatar/ and workspaces/<id>/logo/. See [settings](../guides/how-to-use-settings.md) for ownership, cleanup and reconciliation.

## Walkthrough videos

The FILES bucket also holds the site's walkthrough videos under `media/<hash>/`, uploaded by `bun run media:upload --env <env>` and served publicly by the Worker at `/media/<hash>/<file>`. They are not user data: no `files` row names them, storage reconciliation scans only `workspaces/` and `users/`, and exports and erasures never touch them. [how-to-record-walkthrough-videos.md](../guides/how-to-record-walkthrough-videos.md)

## Orphaned storage

Optional daily maintenance and on-demand admin reports use `STORAGE_RECONCILE=off|report|delete` (required; explicitly off in the starter). `bun run setup:storage --env all --dry-run` previews source configuration; `doctor` checks it. Start with a report; deletion is permanent and only touches registered application key shapes older than 24 hours with no live, trashed, avatar/logo or pending-upload reference. See [storage reconciliation](trash.md#optional-storage-reconciliation) for the cursor job, admin actions, audit results and safety contract.

Temporary data exports use `exports/`. Preview the separate lifecycle backstop with `bun run setup:privacy-storage --env all --dry-run`; real execution requires account-change approval. Two-day object expiry and one-day multipart abort complement the hourly app purge and exact 24-hour download expiry. [Privacy guide](data-privacy.md#storage-expiry-setup).

### Erasure and late uploads

Binding uploads recheck their exact live-or-trashed row after R2 writes; an erased reference refuses success and schedules durable targeted cleanup on failure. Already-issued presigned PUTs remain valid for 3,600 seconds. Erasure preserves old workspace prefixes (uploads/logos) and user avatar prefixes, sweeps after that window and again 24 hours after the first successful sweep, with reference/existence guards and durable retries even when `STORAGE_RECONCILE=off`. See [the exact windows and slow-write residual](data-privacy.md#uploads-already-in-flight-when-erasure-starts).
