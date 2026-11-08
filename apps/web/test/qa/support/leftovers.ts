import { isQaAddress } from "./address";

/** Leftovers are at least this old, so the nightly job never races a running QA suite. */
export const LEFTOVER_MIN_AGE_MS = 2 * 60 * 60 * 1000;
/** At most this many accounts per night: more means something else is wrong. */
export const LEFTOVER_MAX_PER_RUN = 50;

export interface UserRow {
  readonly id: string;
  readonly email: string;
  readonly role: string;
  readonly createdAt: string;
}

/**
 * The accounts the nightly cleanup may erase: QA suite addresses only
 * (`qa-<runId>-<role>@<domain>`), never an admin, never the QA admin itself, and only
 * those older than LEFTOVER_MIN_AGE_MS.
 */
export function selectLeftovers(
  rows: readonly UserRow[],
  options: {
    readonly domain: string;
    readonly adminEmail: string;
    readonly now: Date;
  }
): UserRow[] {
  return rows.filter(
    (row) =>
      isQaAddress(row.email, options.domain) &&
      row.email.toLowerCase() !== options.adminEmail.toLowerCase() &&
      !row.role.split(",").includes("admin") &&
      options.now.getTime() - Date.parse(row.createdAt) >= LEFTOVER_MIN_AGE_MS
  );
}

/** Whether a shared workspace may go with its owner: every member is a QA suite address. */
export function onlyQaMembers(
  members: readonly { readonly email: string }[],
  domain: string
): boolean {
  return members.every((member) => isQaAddress(member.email, domain));
}
