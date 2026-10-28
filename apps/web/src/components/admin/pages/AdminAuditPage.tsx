import type {
  AuditAction,
  AuditTargetType,
} from "@cloudflare-starter/features";
import {
  AdminAuditFilterBar,
  type AdminAuditFilters,
  AdminAuditTable,
  Card,
  DataState,
  EmptyState,
  MembersTableSkeleton,
} from "@cloudflare-starter/ui";
import { ScrollText } from "lucide-react";
import { useState } from "react";

import { trpc } from "@/lib/trpc/client";

import { usePagedList } from "../use-paged-list";

/** Every action of the audit catalog (packages/features/src/audit/domain/audit-event.ts). */
const ACTIONS = [
  "auth.sign_in",
  "auth.sign_in_failed",
  "auth.sign_up",
  "auth.password_reset_requested",
  "auth.password_changed",
  "user.role_changed",
  "user.banned",
  "user.unbanned",
  "user.sessions_revoked",
  "user.password_reset_sent",
  "user.deleted",
  "impersonation.started",
  "impersonation.stopped",
  "workspace.created",
  "workspace.member_joined",
  "workspace.member_left",
  "workspace.invitation_created",
  "workspace.invitation_accepted",
  "workspace.invitation_revoked",
  "workspace.member_role_changed",
  "workspace.member_removed",
  "workspace.ownership_transferred",
  "workspace.owner_assigned",
  "workspace.deleted",
] as const satisfies readonly AuditAction[];
const TARGET_TYPES = [
  "user",
  "email",
  "workspace",
  "invitation",
] as const satisfies readonly AuditTargetType[];

type Action = (typeof ACTIONS)[number];
type TargetType = (typeof TARGET_TYPES)[number];

/** `/admin/audit`: the audit log, newest first, filtered on the server. */
export function AdminAuditPage() {
  const [filters, setFilters] = useState<AdminAuditFilters>({});
  const query = {
    action: filters.action as Action | undefined,
    targetType: filters.targetType as TargetType | undefined,
  };
  const list = usePagedList(async (cursor) => {
    const page = await trpc.admin.audit.list.query({ ...query, cursor });
    return { items: page.events, nextCursor: page.nextCursor };
  }, JSON.stringify(query));

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-fg">Audit log</h1>
      <AdminAuditFilterBar
        actions={ACTIONS}
        targetTypes={TARGET_TYPES}
        value={filters}
        onValueChange={setFilters}
      />
      <Card className="p-0">
        <DataState
          status={list.first.status}
          data={list.first.data}
          error={list.first.error}
          onRetry={list.first.refetch}
          isEmpty={(page) => page.items.length === 0}
          loading={<MembersTableSkeleton rows={8} />}
          empty={
            <EmptyState
              variant="compact"
              icon={<ScrollText />}
              title="No events match"
              description="Remove a filter, or wait for something to happen."
            />
          }
        >
          {() => (
            <AdminAuditTable
              events={list.items}
              onLoadMore={list.loadMore}
              loadingMore={list.loadingMore}
            />
          )}
        </DataState>
      </Card>
    </section>
  );
}
