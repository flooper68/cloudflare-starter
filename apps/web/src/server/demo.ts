/**
 * Demo mode's settings as the demo feature's jobs need them
 * (docs/guides/how-to-run-a-public-demo.md). Starter-only: a project built from the
 * starter keeps DEMO_MODE=off and may delete this file with the demo feature.
 */
import type { DemoRuntime } from "@cloudflare-starter/features";

import { buildRawEnv, buildRequiredConfig } from "@/lib/env";
import type { AppEnv } from "@/server/env";

/** A lowercase hostname, as QA_EMAIL_DOMAIN must be. */
const HOSTNAME =
  /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/**
 * DEMO_MODE with its retention policy: DEMO_RETENTION_DAYS, DEMO_PROTECTED_EMAILS, the
 * BOOTSTRAP_ADMIN_EMAIL and, when set, QA_EMAIL_DOMAIN (the automated QA suite's
 * accounts, which it erases itself, so the demo neither warns nor erases them).
 */
export function demoRuntimeFor(env: AppEnv): DemoRuntime {
  const config = buildRequiredConfig(env);
  if (config.demo.mode === "off") return { mode: "off" };
  const qaDomain = buildRawEnv(env).QA_EMAIL_DOMAIN?.trim().toLowerCase();
  return {
    mode: "on",
    sampleData: config.demo.sampleData,
    workspaceMode: config.workspaces.mode,
    policy: {
      retentionDays: config.demo.retentionDays,
      protectedEmails: config.demo.protectedEmails,
      bootstrapAdminEmail:
        config.workspaces.bootstrapAdminEmail?.trim().toLowerCase() || null,
      qaEmailDomain: qaDomain && HOSTNAME.test(qaDomain) ? qaDomain : null,
    },
  };
}
