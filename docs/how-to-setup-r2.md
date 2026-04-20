# How To Setup R2 For The Upload Demo

This guide explains how to provision Cloudflare R2 so that the `/app/upload-demo` route works in local dev and in deployed environments.

The upload flow lives in [packages/features/src/storage](../packages/features/src/storage/index.ts) and is consumed by the web app. It uses the S3-compatible R2 endpoint via `aws4fetch` — **not** an R2 Worker binding — so you provision an R2 access key, not a `[[r2_buckets]]` binding.

## What You Need

Before you start:

1. A Cloudflare account with R2 enabled (free tier is fine for the demo).
2. Wrangler authenticated locally (`bunx wrangler login`).
3. A bucket name you want to use for uploaded files.

Official references:

- [R2 getting started](https://developers.cloudflare.com/r2/get-started/)
- [R2 S3-compatible API tokens](https://developers.cloudflare.com/r2/api/tokens/)
- [R2 S3 API reference](https://developers.cloudflare.com/r2/api/s3/api/)

## How The App Uses R2

- Uploads are PUT directly from the browser to a presigned URL.
- Downloads are served via a short-lived presigned GET URL.
- Object keys follow the canonical format `uploads/{yyyy}/{mm}/{fileId}`.
- Ownership is enforced by the local `files` table — signed URLs are only issued to the uploading user.
- The hard limit on upload size is 10 MB (enforced in [`uploadInputSchema`](../packages/features/src/storage/index.ts)).

## Step 1: Create The Bucket

Pick a name that matches the environment. This repo defaults to `cloudflare-starter-files` in [.env.example](../.env.example). You can use a single bucket across environments or per-environment buckets — the code does not care as long as `R2_FILES_BUCKET_NAME` points at a real bucket.

```bash
bunx wrangler r2 bucket create cloudflare-starter-files
```

Verify:

```bash
bunx wrangler r2 bucket list
```

Important:

- R2 bucket names are account-scoped. Two accounts can each have a bucket with the same name.
- If you want separate buckets for `develop`, `staging`, and `production`, create three buckets and configure each environment's `R2_FILES_BUCKET_NAME` independently.

## Step 2: Find Your Account ID

You need this for `R2_ACCOUNT_ID`.

- Dashboard: open any R2 bucket page. The account ID is shown in the sidebar and in the S3 endpoint `https://<account-id>.r2.cloudflarestorage.com`.
- CLI: `bunx wrangler whoami` lists the account ID.

## Step 3: Create An R2 API Token

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

## Step 4: Fill In Local Environment Values

Edit `.env` at the repo root:

```env
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_FILES_BUCKET_NAME=cloudflare-starter-files
```

Start the app:

```bash
bun run dev:web
```

Open `http://localhost:4321/app/upload-demo`, select a file, and confirm the page shows progress, a `fileId`, and a working signed download URL.

## Step 5: Set Secrets For Deployed Environments

From [apps/web](../apps/web/README.md):

```bash
cd apps/web
bunx wrangler secret put R2_ACCOUNT_ID
bunx wrangler secret put R2_ACCESS_KEY_ID
bunx wrangler secret put R2_SECRET_ACCESS_KEY
bunx wrangler secret put R2_FILES_BUCKET_NAME
```

Repeat for `--env staging` and `--env production` as needed.

If you use per-environment buckets, set a different `R2_FILES_BUCKET_NAME` per environment.

## Step 6: (Optional) Configure CORS On The Bucket

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

### Upload Demo Returns A Configuration Error

Symptom:

- `/app/upload-demo` returns a precondition error from the API before any upload starts.

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

1. `bunx wrangler r2 bucket create cloudflare-starter-files`
2. Note your Cloudflare account ID
3. Create an R2 API token scoped to the bucket (Object Read & Write)
4. Fill `R2_*` in `.env` and run `bun run dev:web`
5. For deploys: `bunx wrangler secret put R2_*` in `apps/web`
6. Add a CORS policy on the bucket for your web origin(s)
