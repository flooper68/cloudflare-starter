import {
  Avatar,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataState,
  EmptyState,
  Field,
  Input,
  SkeletonCard,
  toast,
} from "@cloudflare-starter/ui";
import { useEffect, useState } from "react";
import { useWorkspace } from "@/components/shared/spa/workspace-context";
import { trpc } from "@/lib/trpc/client";
import { useAsync } from "@/lib/use-async";

export function WorkspaceSettingsPage() {
  const { active, mode, list } = useWorkspace();
  const loaded = useAsync(
    () =>
      active
        ? trpc.workspace.settings.query({ workspaceId: active.id })
        : Promise.resolve(null),
    active?.id ?? "none"
  );
  const [name, setName] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (loaded.data) setName(loaded.data.name);
    setConfirmName("");
  }, [loaded.data]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to update workspace"
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-fg">Workspace settings</h2>
      <DataState
        {...loaded}
        onRetry={loaded.refetch}
        loading={<SkeletonCard />}
        empty={
          <EmptyState
            title="No workspace selected"
            description="Select or create a workspace from the workspace menu."
          />
        }
      >
        {(workspace) =>
          workspace && (
            <>
              <Card>
                <CardContent className="space-y-4">
                  <form
                    className="space-y-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void run(async () => {
                        await trpc.workspace.update.mutate({
                          workspaceId: workspace.id,
                          name,
                        });
                        await list.refetch();
                        await loaded.refetch();
                        toast.success("Workspace saved");
                      });
                    }}
                  >
                    <Field label="Workspace name">
                      <Input
                        value={name}
                        required
                        maxLength={80}
                        disabled={!workspace.canManage}
                        onChange={(event) => setName(event.target.value)}
                      />
                    </Field>
                    {workspace.canManage ? (
                      <Button disabled={busy} type="submit">
                        Save workspace
                      </Button>
                    ) : (
                      <p className="text-sm text-fg-muted">
                        Only workspace owners can change these settings.
                      </p>
                    )}
                  </form>
                  <Avatar
                    name={workspace.name}
                    src={workspace.logoUrl ?? undefined}
                    size="lg"
                  />
                  {workspace.canManage ? (
                    <>
                      <Field
                        label="Upload logo"
                        description="PNG, JPEG or WebP, up to 1 MB."
                      >
                        <Input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          disabled={busy}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file)
                              void run(async () => {
                                const response = await fetch(
                                  `/api/workspaces/${encodeURIComponent(workspace.id)}/logo`,
                                  {
                                    method: "POST",
                                    headers: { "content-type": file.type },
                                    body: file,
                                  }
                                );
                                if (!response.ok) {
                                  const error = (await response.json()) as {
                                    detail?: string;
                                  };
                                  throw new Error(
                                    error.detail ?? "Unable to upload logo"
                                  );
                                }
                                await loaded.refetch();
                                toast.success("Logo updated");
                              });
                          }}
                        />
                      </Field>
                      {workspace.logoUrl ? (
                        <Button
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await trpc.workspace.removeLogo.mutate({
                                workspaceId: workspace.id,
                              });
                              await loaded.refetch();
                              toast.success("Logo removed");
                            })
                          }
                        >
                          Remove logo
                        </Button>
                      ) : null}
                    </>
                  ) : null}
                </CardContent>
              </Card>
              {workspace.canDelete &&
              mode === "multi" &&
              workspace.kind === "shared" ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Delete workspace</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form
                      className="space-y-4"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void run(async () => {
                          await trpc.workspace.delete.mutate({
                            workspaceId: workspace.id,
                            confirmName,
                          });
                          await list.refetch();
                          window.location.href = "/app/dashboard";
                        });
                      }}
                    >
                      <p className="text-sm text-fg-muted">
                        Permanently deletes this workspace, its files and
                        memberships. This cannot be undone.
                      </p>
                      <Field
                        label="Confirm workspace name"
                        description={`Type ${workspace.name} to confirm.`}
                      >
                        <Input
                          value={confirmName}
                          onChange={(event) =>
                            setConfirmName(event.target.value)
                          }
                          autoComplete="off"
                        />
                      </Field>
                      <Button
                        variant="danger"
                        disabled={busy || confirmName !== workspace.name}
                        type="submit"
                      >
                        Delete workspace
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              ) : null}
            </>
          )
        }
      </DataState>
    </div>
  );
}
