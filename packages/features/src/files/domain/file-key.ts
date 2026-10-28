/**
 * The object key of a file: `workspaces/<workspaceId>/uploads/<yyyy>/<mm>/<fileId>`, by
 * upload month (UTC). The workspace prefix keeps each workspace's objects together, so
 * deleting a workspace's data can list them by prefix.
 */
export function buildFileKey(
  workspaceId: string,
  fileId: string,
  uploadedAt: Date
): string {
  const year = uploadedAt.getUTCFullYear();
  const month = String(uploadedAt.getUTCMonth() + 1).padStart(2, "0");
  return `workspaces/${workspaceId}/uploads/${year}/${month}/${fileId}`;
}
