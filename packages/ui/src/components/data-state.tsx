import type { ReactNode } from "react";

import { ErrorState } from "./error-state";

/** Query status, named like TanStack Query ("pending") with "loading" accepted too. */
export type DataStatus = "pending" | "loading" | "error" | "success";

export interface DataStateProps<T> {
  readonly status: DataStatus;
  readonly data: T | undefined;
  readonly error?: unknown;
  /** Shown while loading: a skeleton shaped like the content, not a spinner. */
  readonly loading: ReactNode;
  /** Shown when loaded but there is nothing: an EmptyState with a next step. */
  readonly empty: ReactNode;
  /** Defaults to empty arrays, empty `items` arrays, and null/undefined. */
  readonly isEmpty?: (data: T) => boolean;
  /** Custom error view; defaults to a compact ErrorState with "Try again". */
  readonly errorView?: (error: unknown) => ReactNode;
  readonly onRetry?: () => unknown;
  /** Rendered only with data that is not empty. */
  readonly children: (data: T) => ReactNode;
}

function defaultIsEmpty(data: unknown): boolean {
  if (data == null) return true;
  if (Array.isArray(data)) return data.length === 0;
  const items = (data as { items?: unknown }).items;
  return Array.isArray(items) && items.length === 0;
}

/**
 * The four states every data view must handle, in one place: loading (skeleton), error
 * (ErrorState with retry), empty (EmptyState) and content. Passing all of them is
 * required, so a view cannot forget one.
 *
 * ```tsx
 * <DataState status={query.status} data={query.data} error={query.error}
 *   onRetry={query.refetch} loading={<IssueListSkeleton />}
 *   empty={<EmptyState title="No issues" primaryAction={<NewIssueButton />} />}>
 *   {(issues) => <IssueList issues={issues} />}
 * </DataState>
 * ```
 */
export function DataState<T>({
  status,
  data,
  error,
  loading,
  empty,
  isEmpty = defaultIsEmpty,
  errorView,
  onRetry,
  children,
}: DataStateProps<T>) {
  if (status === "pending" || status === "loading") return <>{loading}</>;
  if (status === "error") {
    return (
      <>
        {errorView ? (
          errorView(error)
        ) : (
          <ErrorState variant="compact" error={error} onRetry={onRetry} />
        )}
      </>
    );
  }
  if (data === undefined || isEmpty(data)) return <>{empty}</>;
  return <>{children(data)}</>;
}
