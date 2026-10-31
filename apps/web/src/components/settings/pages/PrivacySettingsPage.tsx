import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataExportList,
  DataState,
  EmptyState,
  Field,
  Input,
  SkeletonCard,
  toast,
} from "@cloudflare-starter/ui";
import { useState } from "react";
import { useAuth } from "@/components/shared/spa/auth-context";
import { useWorkspace } from "@/components/shared/spa/workspace-context";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc/client";
import { useAsync } from "@/lib/use-async";

export function PrivacySettingsPage() {
  const { user, methods } = useAuth();
  const exports = useAsync(() => trpc.privacy.list.query(), "privacy-exports");
  const { active } = useWorkspace();
  const [requesting, setRequesting] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  async function requestExport(workspaceId?: string) {
    setRequesting(true);
    try {
      await trpc.privacy.requestExport.mutate({ workspaceId });
      toast.success("Data export queued");
      await exports.refetch();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Export request failed"
      );
    } finally {
      setRequesting(false);
    }
  }
  async function download(id: string) {
    setDownloading(id);
    try {
      const link = await trpc.privacy.download.query({ requestId: id });
      window.location.assign(link.href);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Export unavailable"
      );
      await exports.refetch();
    } finally {
      setDownloading(null);
    }
  }
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-fg">Privacy</h2>
      <Card>
        <CardHeader>
          <CardTitle>Export your data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-fg-muted">
            Download your profile, activity and personal workspace files. Shared
            workspace exports are available to their owners. Passwords and
            authentication secrets are excluded.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={requesting} onClick={() => void requestExport()}>
              Request personal export
            </Button>
            {active?.role === "owner" && (
              <Button
                variant="secondary"
                disabled={requesting}
                onClick={() => void requestExport(active.id)}
              >
                Export current workspace
              </Button>
            )}
            <Button variant="secondary" onClick={() => void exports.refetch()}>
              Refresh exports
            </Button>
          </div>
          <DataState
            status={exports.status}
            data={exports.data}
            error={exports.error}
            onRetry={exports.refetch}
            loading={<SkeletonCard />}
            empty={
              <EmptyState
                title="No exports yet"
                description="Request an export to download your data."
              />
            }
          >
            {(items) => (
              <DataExportList
                items={items.map((item) => ({
                  ...item,
                  createdAt: String(item.createdAt),
                  expiresAt: item.expiresAt ? String(item.expiresAt) : null,
                }))}
                downloadingId={downloading}
                onDownload={(id) => void download(id)}
              />
            )}
          </DataState>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Delete account</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setBusy(true);
              void authClient
                .deleteUser({
                  password: password || undefined,
                  callbackURL: "/",
                })
                .then((result) => {
                  if (result.error)
                    throw new Error(authErrorMessage(result.error));
                  window.location.href = "/";
                })
                .catch((error) => toast.error(error.message))
                .finally(() => setBusy(false));
            }}
          >
            <p className="text-sm text-fg-muted">
              Permanently deletes your account and personal workspaces. Transfer
              ownership before leaving a shared workspace with other members.
              You must provide your password or have signed in within the last
              15 minutes.
            </p>
            <Field
              label="Confirm your email"
              description="Type your email address to enable deletion."
            >
              <Input
                type="email"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
              />
            </Field>
            {methods.emailPassword ? (
              <Field label="Current password">
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </Field>
            ) : null}
            <Button
              type="submit"
              variant="danger"
              disabled={busy || confirmation !== user?.email}
            >
              Delete account permanently
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
