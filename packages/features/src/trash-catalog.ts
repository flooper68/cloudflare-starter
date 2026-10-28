// Composition root for the trash: every entity whose rows can be moved to a workspace's
// trash. The trash feature never imports the features it holds; they declare a
// TrashableEntity (defineTrashableEntity) and are listed here. Every table here needs
// `deleted_at` and `deleted_by`, and every read of it outside the trash goes through
// liveIn or trashedIn (test/architecture/trash.test.ts; docs/guides/how-to-use-trash.md).
import { fileTrash } from "./files";
import type { TrashableEntity } from "./trash";

export const TRASH_CATALOG: readonly TrashableEntity[] = [fileTrash];
