# What it costs

::reviewed{date="2026-11-08"}

The whole app runs on one Cloudflare account and one bill: the **$5/month Workers Paid plan, plus usage above the included allowances**. A small app (thousands of users, a few million requests, a few GB of files) stays inside them. The table is the home page's receipt, generated from the same data (`RECEIPT` in `apps/web/src/landing/content.ts`).

<!-- generated:costs -->

| What                  | Included every month          | Above that               |
| --------------------- | ----------------------------- | ------------------------ |
| App, API and agents   | 10M requests                  | then $0.30 / million     |
| Database              | 5 GB · 25B reads · 50M writes | then $1 / million writes |
| File storage          | 10 GB · free egress           | then $0.015 / GB-month   |
| Jobs and schedules    | 1M queue ops                  | then $0.40 / million     |
| Email                 | 3,000 emails                  | then $0.35 / 1,000       |
| Analytics and metrics | 10M data points               | not billed yet           |
| Logs                  | 20M events                    | then $0.60 / million     |
| Bot checks            | unlimited                     | free                     |

Prices from Cloudflare's docs, checked 8 Nov 2026. Your domain is extra.

<!-- /generated:costs -->

## What you reach first

:::gotcha{title="Email: 3,000 a month"}
About 100 a day. Daily digests and invitations add up; above it, $0.35 per 1,000.
:::

:::gotcha{title="Traces and metrics"}
Traces count against Cloudflare's observability allowance from 1 Dec 2026; sampling keeps them low. Metrics data points are free while they are not billed.
:::

Not included: your domain. The rate-limiting binding has no separate published price. Prices change: check [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) before you rely on a number, and update `RECEIPT` when they do.
