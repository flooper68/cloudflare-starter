/** Removes image versions only during already-authorized account/workspace erasure. */
export async function purgeWorkspaceLogos(
  deps: { readonly bucket: R2Bucket },
  input: { readonly workspaceIds: readonly string[] }
): Promise<void> {
  for (const workspaceId of input.workspaceIds) {
    let cursor: string | undefined;
    do {
      const page = await deps.bucket.list({
        prefix: `workspaces/${workspaceId}/logo/`,
        cursor,
        limit: 1000,
      });
      if (page.objects.length)
        await deps.bucket.delete(page.objects.map((object) => object.key));
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
  }
}
