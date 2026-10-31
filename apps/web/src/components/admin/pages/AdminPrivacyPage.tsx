import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  DataState,
  EmptyState,
  Field,
  Input,
  SkeletonCard,
} from "@cloudflare-starter/ui";
import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { useAsync } from "@/lib/use-async";
import { useAdminAction } from "../use-admin-action";
export function AdminPrivacyPage() {
  const data = useAsync(() => trpc.admin.privacy.list.query(), "admin-privacy");
  const { run, dialog } = useAdminAction();
  const [userId, setUserId] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  async function act(erase: boolean) {
    setBusy(true);
    try {
      await run(
        () =>
          erase
            ? trpc.admin.privacy.eraseUser.mutate({ userId })
            : trpc.admin.privacy.requestExport.mutate({ userId }),
        erase ? "Account erased" : "Export queued for the user"
      );
      await data.refetch();
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold text-fg">Data requests</h1>
      <Card>
        <CardHeader>
          <CardTitle>Help a user with their data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-fg-muted">
            Exports are delivered to the user. Erasure requires a recent sign-in
            and the configured second factor, and preserves last-owner and
            last-admin protections.
          </p>
          <Field label="User id">
            <Input value={userId} onChange={(e) => setUserId(e.target.value)} />
          </Field>
          <div className="flex gap-2">
            <Button disabled={!userId || busy} onClick={() => void act(false)}>
              Request user export
            </Button>
            <Button
              variant="danger"
              disabled={!userId || busy}
              onClick={() => setConfirm(true)}
            >
              Erase account
            </Button>
          </div>
        </CardContent>
      </Card>
      <DataState
        status={data.status}
        data={data.data}
        error={data.error}
        onRetry={data.refetch}
        loading={<SkeletonCard />}
        empty={<EmptyState title="No requests yet" />}
      >
        {(value) => (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Exports</CardTitle>
              </CardHeader>
              <CardContent>
                {value.exports.length ? (
                  <ul className="divide-y divide-line">
                    {value.exports.map((x) => (
                      <li key={x.id} className="py-2 text-sm text-fg">
                        <p>
                          {x.userId} · {x.scope} · {x.status}
                        </p>
                        <p className="text-xs text-fg-muted">{x.id}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState title="No exports" />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Erasure records</CardTitle>
              </CardHeader>
              <CardContent>
                {value.erasures.length ? (
                  <ul>
                    {value.erasures.map((x) => (
                      <li key={x.userId} className="py-2 text-sm text-fg">
                        {x.userId} ·{" "}
                        {x.completedAt ? "Completed" : "In progress"}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState title="No erasures" />
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </DataState>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Erase this account permanently?"
        description="This removes the account, its personal workspaces, stored files and credentials. Shared workspace content and documented audit/backup retention remain. This cannot be undone."
        tone="danger"
        confirmLabel="Erase account"
        onConfirm={() => void act(true)}
      />
      {dialog}
    </section>
  );
}
