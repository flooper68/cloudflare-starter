/** Logical buckets a file can live in; one today. */
export const FILE_BUCKETS = ["files"] as const;
export type FileBucket = (typeof FILE_BUCKETS)[number];
