# @cloudflare-starter/container

Cloudflare Container demo. A Worker forwards requests into a Dockerized Python container that spawns a child process to compute digits of pi and returns JSON. The web app's container workflow demo (`/app/container-demo`) calls it through its `PI_CONTAINER_SERVICE` service binding; the Worker has no public URL ([docs/guides/how-to-run-container-workflows.md](../../docs/guides/how-to-run-container-workflows.md)).

Requires the Workers Paid plan and a local Docker-compatible engine (Wrangler builds the image locally before running or deploying).

See [docs/guides/how-to-setup-container.md](../../docs/guides/how-to-setup-container.md) for setup and deployment.

## Develop

```bash
bun run dev:container
```

Runs on port `8790`. Try: `http://127.0.0.1:8790/pi?digits=20` (`digits` 1 to 100,000, `instance` 0 or 1).

## Deploy

```bash
cd apps/container
bun run build               # dry run
bun run deploy:staging      # or deploy (develop), deploy:production
```

The web app's deploy scripts run these first. The Worker uses the `lite` instance type, at most two instances, and sleeps after 30 s idle.
