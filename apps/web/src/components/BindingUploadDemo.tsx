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
import { UNEXPECTED_ERROR_MESSAGE } from "@/lib/error-reference";

interface UploadResponse {
  readonly fileId?: string;
  readonly url?: string;
  readonly error?: string;
  /** Present on unexpected (500) failures: the trace id to quote. */
  readonly reference?: string;
}

interface UploadFailure {
  readonly message: string;
  readonly reference?: string;
}

export function BindingUploadDemo() {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [status, setStatus] = useState("No file uploaded yet.");
  const [failure, setFailure] = useState<UploadFailure | null>(null);
  const [uploading, setUploading] = useState(false);

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setFileUrl(null);
    setFailure(null);
    setStatus("Uploading through the Worker...");

    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/files", { method: "POST", body });
      const result = (await response.json()) as UploadResponse;

      if (!response.ok || !result.url) {
        setFailure({
          message: result.reference
            ? UNEXPECTED_ERROR_MESSAGE
            : (result.error ?? `Upload failed (${response.status})`),
          reference: result.reference,
        });
        setStatus("Not uploaded.");
        return;
      }

      setFileUrl(result.url);
      setStatus(`Stored as ${result.fileId}.`);
    } catch (error) {
      setFailure({
        message: error instanceof Error ? error.message : "Upload failed",
      });
      setStatus("Not uploaded.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card className="space-y-5">
      <div className="space-y-2">
        <CardTitle>Through the Worker (binding)</CardTitle>
        <CardDescription>
          POST to `/api/files`; the Worker writes to the `FILES` binding and
          serves it back only to you. Works locally with no R2 credentials.
        </CardDescription>
      </div>

      <div className="space-y-2">
        <Label htmlFor="binding-upload-file">Choose a file</Label>
        <Input
          disabled={uploading}
          id="binding-upload-file"
          type="file"
          onChange={onFileChange}
        />
      </div>

      {failure ? (
        <ErrorState
          variant="inline"
          description={failure.message}
          reference={failure.reference}
        />
      ) : (
        <div className="rounded-xl bg-surface p-4 text-sm text-fg-muted">
          <p>Status: {status}</p>
        </div>
      )}

      {fileUrl ? (
        <a href={fileUrl} rel="noreferrer" target="_blank">
          <Button variant="outline">Open file</Button>
        </a>
      ) : null}
    </Card>
  );
}
