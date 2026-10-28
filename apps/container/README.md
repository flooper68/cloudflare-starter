# @cloudflare-starter/container

Cloudflare Container demo. A Worker forwards requests into a Dockerized Python container that spawns a child process to compute digits of pi and returns JSON.

Requires the Workers Paid plan and a local Docker-compatible engine (Wrangler builds the image locally before running or deploying).

See [docs/how-to-setup-container.md](../../docs/how-to-setup-container.md) for setup and deployment.

## Develop

```bash
bun run dev:container
```

Runs on port `8790`. Try: `http://127.0.0.1:8790/pi?digits=20`.

## Deploy

```bash
cd apps/container
bun run build
bunx wrangler deploy --env staging
```
