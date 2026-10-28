import { toast } from "@cloudflare-starter/ui";
import { useState } from "react";

import { type AsyncState, useAsync } from "@/lib/use-async";

export interface Page<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}

export interface PagedList<T> {
  readonly first: AsyncState<Page<T>>;
  /** Every item loaded so far: the first page and the ones "Load more" added. */
  readonly items: readonly T[];
  readonly loadMore: (() => void) | undefined;
  readonly loadingMore: boolean;
}

/**
 * A server-paged list (keyset cursors): loads the first page whenever `key` (the filters)
 * changes, and appends the next page on `loadMore`.
 */
export function usePagedList<T>(
  load: (cursor: string | undefined) => Promise<Page<T>>,
  key: string
): PagedList<T> {
  const [more, setMore] = useState<{
    readonly key: string;
    readonly items: readonly T[];
    readonly cursor: string | null;
  } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const first = useAsync(() => load(undefined), key);

  const extra = more?.key === key ? more : null;
  const cursor = extra ? extra.cursor : (first.data?.nextCursor ?? null);
  const items = [...(first.data?.items ?? []), ...(extra?.items ?? [])];

  return {
    first,
    items,
    loadingMore,
    loadMore: cursor
      ? () => {
          setLoadingMore(true);
          void load(cursor)
            .then((page) =>
              setMore({
                key,
                items: [...(extra?.items ?? []), ...page.items],
                cursor: page.nextCursor,
              })
            )
            .catch((error: unknown) =>
              toast.error(
                error instanceof Error ? error.message : "Couldn't load more"
              )
            )
            .finally(() => setLoadingMore(false));
        }
      : undefined,
  };
}
