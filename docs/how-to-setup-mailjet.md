# How To Setup Mailjet For The Email Demo

This guide explains how to provision Mailjet so that the `/app/email-demo` route can send a test email in local dev and in deployed environments.

The email service lives in [packages/features/src/email](../packages/features/src/email/index.ts). It posts to the Mailjet Send API v3.1 with HTTP Basic auth — no SDK, no binding, just `fetch`.

## What You Need

Before you start:

1. A Mailjet account.
2. A verified sender email or sender domain in Mailjet.
3. Wrangler authenticated locally (`bunx wrangler login`) if you plan to deploy.

Official references:

- [Mailjet account setup](https://dev.mailjet.com/email/guides/getting-started/)
- [Mailjet Send API v3.1](https://dev.mailjet.com/email/reference/send-emails/)
- [Mailjet API keys](https://app.mailjet.com/account/apikeys)
- [Mailjet sandbox mode](https://dev.mailjet.com/email/guides/send-api-v31/#sandbox-mode)

## How The App Uses Mailjet

- The API is called directly with `fetch` from the worker runtime.
- Auth is HTTP Basic: `base64(API_KEY:SECRET_KEY)`.
- When `MAILJET_SANDBOX=true`, Mailjet validates the request but does **not** deliver the email. This is the right default for development.
- The sender address is always `MAILJET_FROM_EMAIL` + `MAILJET_FROM_NAME`. The recipient is whoever is signed in when they trigger `/app/email-demo`.

## Step 1: Create A Mailjet Account

Sign up at [mailjet.com](https://www.mailjet.com/). The free plan is sufficient for the demo.

## Step 2: Verify A Sender

Mailjet refuses to send mail from an unverified sender.

1. Open **Account Settings** → **Senders & Domains** → **Add a sender domain or address**.
2. Add the email address you want the demo to send _from_ (this becomes `MAILJET_FROM_EMAIL`).
3. Follow Mailjet's verification flow (click the verification email, or set DNS records for a whole domain).

Important:

- For a quick test, verify a single address.
- For production, verify the full domain with SPF and DKIM records so your mail is not flagged as spam.

## Step 3: Get Your API Keys

1. Open **API Keys** at [app.mailjet.com/account/apikeys](https://app.mailjet.com/account/apikeys).
2. Copy the **API Key** → `MAILJET_API_KEY`.
3. Copy the **Secret Key** → `MAILJET_SECRET_KEY`.

Important:

- The secret key is shown in the dashboard but treat it like any other credential — rotate it if it leaks.
- For per-environment isolation, you can create separate Mailjet sub-accounts (available on paid plans) and use different API key pairs per environment.

## Step 4: Fill In Local Environment Values

Edit `apps/web/.dev.vars`:

```env
MAILJET_API_KEY=your-api-key
MAILJET_SECRET_KEY=your-secret-key
MAILJET_FROM_EMAIL=noreply@your-domain.com
MAILJET_FROM_NAME=Cloudflare Starter
MAILJET_SANDBOX=true
```

Keep `MAILJET_SANDBOX=true` unless you actually want mail delivered. Sandbox mode lets you exercise the full request/response path without sending real email.

Start the app:

```bash
bun run dev:web
```

Open `http://localhost:4321/app/email-demo` while signed in and click the send button. In sandbox mode you should see a successful response with no email delivered. Set `MAILJET_SANDBOX=false` to deliver a real message to your signed-in address.

## Step 5: Set Secrets For Deployed Environments

From [apps/web](../apps/web/README.md):

```bash
cd apps/web
bunx wrangler secret put MAILJET_API_KEY
bunx wrangler secret put MAILJET_SECRET_KEY
bunx wrangler secret put MAILJET_FROM_EMAIL
bunx wrangler secret put MAILJET_FROM_NAME
bunx wrangler secret put MAILJET_SANDBOX
```

Repeat with `--env staging` and `--env production` as needed. Most setups keep `MAILJET_SANDBOX=true` in `develop` and `staging` and flip it to `false` only in `production`.

## Common Problems

### Mailjet Returns 401 Unauthorized

Symptom:

- The API response is `401` with an `ErrorInfo` indicating bad credentials.

Fix:

- Re-copy the API key and secret from the Mailjet dashboard; leading/trailing whitespace is a common cause.
- Confirm you pasted the **secret key**, not a second API key.

### Mailjet Returns 400 With "From address is invalid"

Symptom:

- The request is authenticated but rejected with a sender error.

Fix:

- `MAILJET_FROM_EMAIL` must be a verified sender in the Mailjet account that owns the API key.
- If you verified a domain, the address only has to match that domain; if you verified a single address, it has to match exactly.

### Email Is Sent But Never Arrives

Symptom:

- The API returns `200`, but no mail shows up.

Fix:

- Check `MAILJET_SANDBOX` — sandbox mode deliberately suppresses delivery.
- Check spam/junk folders.
- Check Mailjet's **Statistics** tab for bounced or blocked deliveries.
- For production, make sure SPF/DKIM for the sender domain are set correctly.

### Email Demo Returns A Configuration Error

Symptom:

- `/app/email-demo` returns a precondition error before any request reaches Mailjet.

Fix:

- All five `MAILJET_*` variables must be set. Missing any of them disables the feature.
- After setting secrets on a deployed worker, redeploy for the new values to take effect.

## Quick Setup Checklist

1. Create a Mailjet account
2. Verify a sender address or domain
3. Copy API key + secret from the Mailjet dashboard
4. Fill `MAILJET_*` in `apps/web/.dev.vars` with `MAILJET_SANDBOX=true` and run `bun run dev:web`
5. For deploys: `bunx wrangler secret put MAILJET_*` in `apps/web`
6. Flip `MAILJET_SANDBOX=false` only in the environment(s) that should actually send mail
