import { BindingUploadDemo } from "@/components/BindingUploadDemo";
import { useWorkspace } from "@/components/shared/spa/workspace-context";
import { UploadDemoClient } from "@/components/UploadDemoClient";
import { WorkspaceFiles } from "@/components/WorkspaceFiles";
import { FlagGate } from "@/lib/feature-flags";
import { trpc } from "@/lib/trpc/client";
import { useAsync } from "@/lib/use-async";

export function UploadDemoPage() {
  const { active } = useWorkspace();
  const workspaceId = active?.id;
  const files = useAsync(
    () => trpc.storage.listFiles.query({ workspaceId }),
    workspaceId ?? ""
  );

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">
          Upload Demo
        </p>
        <h2 className="text-3xl font-semibold text-fg">Two ways into R2</h2>
        <p className="max-w-3xl text-sm leading-6 text-fg-muted">
          Both paths share the same file table and workspace rules. Through the
          Worker, the bytes pass the `FILES` binding and every read is checked.
          Presigned, the browser talks to R2 directly with a short-lived URL.
          Pick per feature.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <BindingUploadDemo onUploaded={() => void files.refetch()} />
        {/* Example feature flag: the presigned path can be rolled out or switched off. */}
        <FlagGate flag="upload-demo-presigned">
          <UploadDemoClient />
        </FlagGate>
      </div>

      <WorkspaceFiles files={files} />
    </section>
  );
}
