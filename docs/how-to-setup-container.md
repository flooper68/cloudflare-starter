# How To Setup And Deploy The Container Demo

This guide explains how to run and deploy the Cloudflare Container demo in this repo.

The demo lives in [apps/container](/Users/premylsciompa/dev_personal/cloudflare-starter/apps/container) and exposes a Worker that forwards requests into a Dockerized Python container. The container starts a child process on each request, computes digits of pi, and returns JSON.

## What You Need

Before you start:

1. Install Bun.
2. Install Docker Desktop or another Docker-compatible local engine.
3. Have a Cloudflare account with the Workers Paid plan.
4. Be able to log in with Wrangler.

Why those prerequisites matter:

- Cloudflare Containers are available on the Workers Paid plan.
- `wrangler dev` and `wrangler deploy` build the Docker image locally before running or deploying it.

Official references:

- [Cloudflare Containers overview](https://developers.cloudflare.com/containers/)
- [Cloudflare Containers getting started](https://developers.cloudflare.com/containers/get-started/)
- [Cloudflare Containers local development](https://developers.cloudflare.com/containers/local-dev/)
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)

## Step 1: Install Dependencies

From the repo root:

```bash
cd /Users/premylsciompa/dev_personal/cloudflare-starter
bun install
```

## Step 2: Verify Docker Is Running

Run:

```bash
docker info
```

If Docker is not running, start Docker Desktop first and rerun the command.

## Step 3: Authenticate Wrangler

If you have not already logged in:

```bash
bunx wrangler login
```

Optional check:

```bash
bunx wrangler whoami
```

## Step 4: Review The Container Worker Config

The deployable Worker is configured here:

- [apps/container/wrangler.jsonc](/Users/premylsciompa/dev_personal/cloudflare-starter/apps/container/wrangler.jsonc)
- [apps/container/src/index.ts](/Users/premylsciompa/dev_personal/cloudflare-starter/apps/container/src/index.ts)
- [apps/container/Dockerfile](/Users/premylsciompa/dev_personal/cloudflare-starter/apps/container/Dockerfile)

Important values in `wrangler.jsonc`:

- Worker name: `cloudflare-starter-container`
- Container Durable Object binding: `PI_CONTAINER`
- Container class: `PiContainer`
- Docker image source: local `./Dockerfile`

## Step 5: Test It Locally

From the repo root:

```bash
bun run dev:container
```

In another terminal:

```bash
curl 'http://127.0.0.1:8787/pi?digits=20'
```

Expected shape of the response:

```json
{
  "ok": true,
  "digits": 20,
  "pi": "3.14159265358979323846",
  "elapsedMs": 146.95,
  "containerPid": 1
}
```

Notes:

- The first request is slower because Wrangler may need to build and start the container.
- During local development, Docker is used on your machine.

## Step 6: Deploy To Cloudflare

The package `build` script is a dry run. For a real deployment, run Wrangler directly from the container app directory.

```bash
cd /Users/premylsciompa/dev_personal/cloudflare-starter/apps/container
bunx wrangler deploy
```

What happens during deploy:

1. Wrangler builds the Docker image locally.
2. Wrangler pushes the image to the Cloudflare-managed container registry.
3. Wrangler deploys the Worker.
4. Cloudflare provisions the container runtime for that Worker.

Important:

- The first deployment can take a few minutes.
- Right after the deploy succeeds, container-backed requests may still fail briefly while the container platform finishes provisioning.

## Step 7: Check Deployment Status

From the repo root or from `apps/container`:

```bash
bunx wrangler containers list
bunx wrangler containers images list
```

These commands help confirm that the container image and deployment are present in your Cloudflare account.

## Step 8: Test The Deployed Worker

Use the `workers.dev` URL printed by `wrangler deploy`, then call it with a query like this:

```bash
curl 'https://cloudflare-starter-container.<your-subdomain>.workers.dev/pi?digits=20'
```

If deployment is ready, you should get the same JSON structure as local development.

## Step 9: Deploy Future Changes

Whenever you change either:

- Worker code in [apps/container/src/index.ts](/Users/premylsciompa/dev_personal/cloudflare-starter/apps/container/src/index.ts)
- Container code in [apps/container/server.py](/Users/premylsciompa/dev_personal/cloudflare-starter/apps/container/server.py), [apps/container/pi_task.py](/Users/premylsciompa/dev_personal/cloudflare-starter/apps/container/pi_task.py), or [apps/container/Dockerfile](/Users/premylsciompa/dev_personal/cloudflare-starter/apps/container/Dockerfile)

redeploy with:

```bash
cd /Users/premylsciompa/dev_personal/cloudflare-starter/apps/container
bunx wrangler deploy
```

## Common Problems

### Docker Is Not Running

Symptom:

- `wrangler dev` or `wrangler deploy` fails while building the image.

Fix:

- Start Docker Desktop.
- Re-run `docker info`.

### First Deploy Works But Requests Fail Right Away

Symptom:

- The Worker deploys, but the first few container-backed requests return an error.

Fix:

- Wait a few minutes after the first deploy.
- Retry the request.

This is expected because Cloudflare notes that containers take time to provision after first deployment.

### TLS Or Certificate Errors During Docker Build

Symptom:

- Docker build fails behind a VPN or TLS-inspecting client.

Fix:

- Temporarily disable the VPN/client and retry, or
- follow Cloudflare's certificate guidance in the local development docs.

## Quick Deploy Checklist

1. `bun install`
2. `docker info`
3. `bunx wrangler login`
4. `bun run dev:container`
5. `curl 'http://127.0.0.1:8787/pi?digits=20'`
6. `cd apps/container`
7. `bunx wrangler deploy`
8. `bunx wrangler containers list`
9. `curl 'https://<your-worker-url>/pi?digits=20'`
