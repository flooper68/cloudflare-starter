import {
  Button,
  Card,
  CardDescription,
  CardTitle,
  ErrorState,
  Input,
  Label,
} from "@cloudflare-starter/ui";
import { useState } from "react";
import { BillingLimitPrompt } from "@/components/app/billing/BillingLimitPrompt";
import { useWorkspace } from "@/components/shared/spa/workspace-context";
import { limitRefusalOf } from "@/lib/billing-prompts";
import {
  errorReference,
  UNEXPECTED_ERROR_MESSAGE,
} from "@/lib/error-reference";
import { trpc } from "@/lib/trpc/client";
import { usePresignedUpload } from "@/lib/upload-client";

export function UploadDemoClient() {
  const { active } = useWorkspace();
  const workspaceId = active?.id;
  const [fileId, setFileId] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("No file uploaded yet.");
  const [failure, setFailure] = useState<unknown>(null);

  const upload = usePresignedUpload(async (file) =>
    trpc.storage.createUpload.mutate({
      workspaceId,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
    })
  );

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus("Creating file record and uploading to R2...");
    setDownloadUrl(null);
    setFailure(null);

    try {
      const result = await upload.upload(file);
      setFileId(result.fileId);
      const signed = await trpc.storage.getDownloadUrl.query({
        workspaceId,
        fileId: result.fileId,
      });
      setDownloadUrl(signed.url);
      setStatus("Upload complete. Signed download URL minted.");
    } catch (error) {
      setFailure(error);
      setStatus("Not uploaded.");
    }
  }

  // A plan limit or a feature not in the plan (tRPC data.appCode / data.domain).
  const refusal = limitRefusalOf(failure);

  return (
    <Card className="space-y-5">
      <div className="space-y-2">
        <CardTitle>Direct to R2 (presigned URL)</CardTitle>
        <CardDescription>
          The browser PUTs straight to R2 with a presigned URL; the Worker only
          signs. Needs R2 API keys and bucket CORS
          (docs/guides/how-to-setup-r2.md).
        </CardDescription>
      </div>

      <div className="space-y-2">
        <Label htmlFor="presigned-upload-file">Choose a file</Label>
        <Input id="presigned-upload-file" type="file" onChange={onFileChange} />
      </div>

      {refusal ? (
        <BillingLimitPrompt refusal={refusal} />
      ) : failure ? (
        <ErrorState
          variant="inline"
          error={failure}
          description={
            errorReference(failure) ? UNEXPECTED_ERROR_MESSAGE : undefined
          }
          reference={errorReference(failure)}
        />
      ) : null}

      <div className="rounded-xl bg-surface p-4 text-sm text-fg-muted">
        <p>Status: {status}</p>
        <p>Uploading: {upload.isUploading ? "yes" : "no"}</p>
        <p>Progress: {upload.progress}%</p>
        {fileId ? <p>File ID: {fileId}</p> : null}
      </div>

      {downloadUrl ? (
        <a href={downloadUrl} rel="noreferrer" target="_blank">
          <Button variant="outline">Open signed download URL</Button>
        </a>
      ) : null}
    </Card>
  );
}
