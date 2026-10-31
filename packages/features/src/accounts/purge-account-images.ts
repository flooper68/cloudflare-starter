/** Removes image versions only during already-authorized account/workspace erasure. */
export async function purgeAccountImages(
  deps: { readonly bucket: R2Bucket },
  input: { readonly userId: string }
): Promise<void> {
  let cursor: string | undefined;
  do {
    const page = await deps.bucket.list({
      prefix: `users/${input.userId}/avatar/`,
      cursor,
      limit: 1000,
    });
    if (page.objects.length)
      await deps.bucket.delete(page.objects.map((object) => object.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
}
