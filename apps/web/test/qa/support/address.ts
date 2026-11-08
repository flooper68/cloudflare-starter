import { randomInt } from "node:crypto";

import { DEFAULT_QA_EMAIL_DOMAIN } from "./env";

/** `<yyyymmdd><4 lowercase letters>`, e.g. `20261108kqzt`. */
export const RUN_ID_PATTERN = /^\d{8}[a-z]{4}$/;
/** A role in an address: lowercase letters and digits, e.g. `owner`, `invitee2`. */
export const ROLE_PATTERN = /^[a-z0-9]{1,20}$/;

/** A fresh run id: today's UTC date and four random letters. */
export function newRunId(now: Date = new Date()): string {
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const letters = Array.from({ length: 4 }, () =>
    String.fromCharCode(97 + randomInt(26))
  ).join("");
  return `${date}${letters}`;
}

/**
 * The run's id: QA_RUN_ID, which the QA config's global setup sets once per
 * `playwright test` so every worker shares it (CI may set it too).
 */
export function currentRunId(
  env: Readonly<Record<string, string | undefined>> = process.env
): string {
  const runId = env.QA_RUN_ID;
  if (!runId || !RUN_ID_PATTERN.test(runId)) {
    throw new Error(
      `QA_RUN_ID is ${runId ? `"${runId}"` : "not set"}: run through playwright.qa.config.ts (its global setup sets it), or set it to <yyyymmdd><4 letters>`
    );
  }
  return runId;
}

/**
 * The QA address of one role in one run: `qa+<runId>-<role>@<QA_EMAIL_DOMAIN>`, e.g.
 * `qa+20261108kqzt-owner@qa.flooper.me`. With QA_BYPASS=on the app keeps mail to it in its
 * QA outbox instead of sending it.
 */
export function qaAddress(
  runId: string,
  role: string,
  domain: string = process.env.QA_EMAIL_DOMAIN?.trim().toLowerCase() ||
    DEFAULT_QA_EMAIL_DOMAIN
): string {
  if (!RUN_ID_PATTERN.test(runId)) {
    throw new Error(`runId must be <yyyymmdd><4 letters>, got "${runId}"`);
  }
  if (!ROLE_PATTERN.test(role)) {
    throw new Error(`role must be lowercase letters and digits, got "${role}"`);
  }
  return `qa+${runId}-${role}@${domain}`;
}

/** Whether an address is one of the QA suite's (any run), for cleanup. */
export function isQaAddress(
  email: string,
  domain: string = DEFAULT_QA_EMAIL_DOMAIN
): boolean {
  const match = /^qa\+(\d{8}[a-z]{4})-([a-z0-9]{1,20})@(.+)$/.exec(
    email.trim().toLowerCase()
  );
  return Boolean(match && match[3] === domain.toLowerCase());
}
