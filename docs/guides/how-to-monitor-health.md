# How to monitor health (uptime monitors and status pages)

::reviewed{date="2026-11-09"}

The app answers three public health endpoints for uptime monitors, load balancers and status pages. Readiness checks every dependency with a deadline and answers in the IETF health check format. Use this guide to point a monitor at the app, add a check, or investigate a failing `/health/ready`.

::flow[Monitor -> /health/ready -> Database, storage and settings checks -> pass, warn or fail]{title="Health check: a monitor calls /health/ready, which checks the database, storage and settings and answers pass, warn or fail"}

| Endpoint            | Answers                                                  | Use it for                               |
| ------------------- | -------------------------------------------------------- | ---------------------------------------- |
| `GET /health/live`  | always `200 {"status":"pass"}` while the Worker runs     | "is it reachable": DNS, routing, deploys |
| `GET /health/ready` | `200` for pass and warn, `503` for fail, with the checks | "can people use it": monitors, status    |
| `GET /health`       | the same as `/health/ready`                              | monitors that try `/health` first        |

## Point a monitor at it

:::steps
1. **URL:** `https://<your-app>/health/ready`, method GET, every 1 to 5 minutes, timeout 5 s.
2. **Alert on any status but 200.** A `fail` answers 503; a `warn` answers 200 on purpose (the app works, mail is off or a dependency is slow).
3. **Optional:** a second monitor on `/health/live` tells "unreachable" apart from "a dependency is down".
   :::

```bash
curl -s https://<your-app>/health/ready
```

:::decision{title="Why /health is readiness, not liveness"}
Whoever points a monitor at `/health` wants to know whether the app works, so it checks the dependencies too. Liveness matters to orchestrators that restart processes, which Workers do not need.
:::

:::gotcha{title="Never cached, and rate limited"}
Every answer is `no-store` (a cached pass hides an outage); 120 requests a minute per IP. Point one monitor, not ten, at it.
:::

## Add a check

A check is one entry with a name, a deadline and a probe that answers pass, warn or fail with an observed value; it must never write and never read a session. Platform admins see the same checks with each failure's detail in **Admin › Overview** and through `admin_get_health`.

## Reference

The response format, what each check does, what the public sees and what it does not, tracing and metrics, status pages, adding a check, and troubleshooting: [Health reference](../reference/health.md).
