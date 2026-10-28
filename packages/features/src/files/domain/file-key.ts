/** The object key of a file: `uploads/<yyyy>/<mm>/<fileId>`, by upload month (UTC). */
export function buildFileKey(fileId: string, uploadedAt: Date): string {
  const year = uploadedAt.getUTCFullYear();
  const month = String(uploadedAt.getUTCMonth() + 1).padStart(2, "0");
  return `uploads/${year}/${month}/${fileId}`;
}
