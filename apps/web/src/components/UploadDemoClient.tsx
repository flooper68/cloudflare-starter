import {
  Button,
  Card,
  CardDescription,
  CardTitle,
  Input,
  Label,
} from "@cloudflare-starter/ui";
import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { usePresignedUpload } from "@/lib/upload-client";

export function UploadDemoClient() {
  const [fileId, setFileId] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("No file uploaded yet.");

  const upload = usePresignedUpload(async (file) =>
    trpc.storage.createUpload.mutate({
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

    try {
      const result = await upload.upload(file);
      setFileId(result.fileId);
      const signed = await trpc.storage.getDownloadUrl.query({
        fileId: result.fileId,
      });
      setDownloadUrl(signed.url);
      setStatus("Upload complete. Signed download URL minted.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      setStatus(message);
    }
  }

  return (
    <Card className="space-y-5">
      <div className="space-y-2">
        <CardTitle>Direct to R2 (presigned URL)</CardTitle>
        <CardDescription>
          The browser PUTs straight to R2 with a presigned URL; the Worker only
          signs. Needs R2 API keys and bucket CORS (docs/how-to-setup-r2.md).
        </CardDescription>
      </div>

      <div className="space-y-2">
        <Label htmlFor="presigned-upload-file">Choose a file</Label>
        <Input id="presigned-upload-file" type="file" onChange={onFileChange} />
      </div>

      <div className="rounded-xl bg-zinc-100 p-4 text-sm text-zinc-700">
        <p>Status: {status}</p>
        <p>Uploading: {upload.isUploading ? "yes" : "no"}</p>
        <p>Progress: {upload.progress}%</p>
        {upload.error ? <p>Error: {upload.error}</p> : null}
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
