import { useState } from "react";

export async function uploadFileToPresignedUrl(
  url: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      onProgress?.(Math.round((event.loaded / event.total) * 100));
    });

    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress?.(100);
        resolve();
        return;
      }

      reject(new Error(`Upload failed (${request.status})`));
    });

    request.addEventListener("error", () => reject(new Error("Upload failed")));
    request.addEventListener("abort", () =>
      reject(new Error("Upload aborted"))
    );
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", file.type);
    request.send(file);
  });
}

export function usePresignedUpload(
  requestUpload: (file: File) => Promise<{
    readonly fileId: string;
    readonly r2Key: string;
    readonly uploadUrl: string;
  }>
) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    setIsUploading(true);
    setProgress(0);

    try {
      const result = await requestUpload(file);
      await uploadFileToPresignedUrl(result.uploadUrl, file, setProgress);
      return result;
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Upload failed";
      setError(message);
      throw caught;
    } finally {
      setIsUploading(false);
    }
  }

  return {
    upload,
    isUploading,
    progress,
    error,
  };
}
