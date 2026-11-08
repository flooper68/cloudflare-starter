import { and, type SQL, sql } from "drizzle-orm";

import { user } from "../accounts";
import type { DemoRetentionPolicy } from "./domain";

function likeLiteral(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * The accounts the retention applies to, as a condition on `user`: not platform admins,
 * not BOOTSTRAP_ADMIN_EMAIL, not on DEMO_PROTECTED_EMAILS, not in QA_EMAIL_DOMAIN (all
 * case-insensitive). The same rules as `demoExemption`, which every caller applies to
 * each row again: this keeps exempt accounts out of the scan and the counts.
 */
export function retentionSubjects(
  policy: Omit<DemoRetentionPolicy, "retentionDays">
): SQL {
  const exemptEmails = [
    ...policy.protectedEmails,
    ...(policy.bootstrapAdminEmail ? [policy.bootstrapAdminEmail] : []),
  ];
  const conditions: SQL[] = [
    sql`(',' || replace(coalesce(${user.role}, ''), ' ', '') || ',') NOT LIKE '%,admin,%'`,
  ];
  if (exemptEmails.length > 0)
    conditions.push(
      sql`lower(trim(${user.email})) NOT IN (${sql.join(
        exemptEmails.map((email) => sql`${email}`),
        sql`, `
      )})`
    );
  if (policy.qaEmailDomain)
    conditions.push(
      sql`lower(trim(${user.email})) NOT LIKE ${`%@${likeLiteral(policy.qaEmailDomain)}`} ESCAPE '\\'`
    );
  return and(...conditions) as SQL;
}
