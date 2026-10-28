import { z } from "zod";

export const TRASH_PAGE_SIZE_DEFAULT = 50;
export const TRASH_PAGE_SIZE_MAX = 100;
/** Items one restore or permanent delete may name. */
export const TRASH_ITEMS_MAX = 100;

const entityType = z.string().min(1).max(50);

/** One thing in the trash: its entity type (`file`) and id. */
export const trashItemRefSchema = z.object({
  type: entityType,
  id: z.string().min(1).max(100),
});
export type TrashItemRef = z.infer<typeof trashItemRefSchema>;

/** A page of the trash, optionally of one entity type. */
export const trashListInputSchema = z.object({
  type: entityType.optional(),
  /** `nextCursor` of the previous page. */
  cursor: z.string().min(1).max(300).optional(),
  limit: z.number().int().min(1).max(TRASH_PAGE_SIZE_MAX).optional(),
});
export type TrashListInput = z.infer<typeof trashListInputSchema>;

/** The items a restore or permanent delete acts on, each named once. */
export const trashItemsInputSchema = z.object({
  items: z
    .array(trashItemRefSchema)
    .min(1)
    .max(TRASH_ITEMS_MAX)
    .refine(
      (items) =>
        new Set(items.map((item) => `${item.type}:${item.id}`)).size ===
        items.length,
      { message: "Each item may be named once" }
    ),
});
export type TrashItemsInput = z.infer<typeof trashItemsInputSchema>;

/** Splits `items` into runs of at most `size` (D1 allows 100 bound parameters per query). */
export function chunked<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) {
    throw new RangeError("Chunk size must be a positive integer");
  }
  const chunks: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    chunks.push(items.slice(start, start + size));
  }
  return chunks;
}
