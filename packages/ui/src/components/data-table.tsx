import {
  type ColumnDef,
  columnFilteringFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  type RowData,
  type RowSelectionState,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronsUpDown,
  Minus,
  Search,
  Settings2,
} from "lucide-react";
import {
  Checkbox as CheckboxPrimitive,
  DropdownMenu as DropdownMenuPrimitive,
} from "radix-ui";
import { type ReactNode, useMemo, useState } from "react";

import { focusRing, menuItem, menuLabel, overlayContent } from "../lib/styles";
import { cn } from "../lib/utils";
import { Button } from "./button";
import { Input } from "./input";
import { Pagination } from "./pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";

/** Per-column options read by DataTable (set them in `meta` of a column definition). */
export interface DataTableColumnMeta {
  /** Name in the column visibility menu (defaults to a string header or the id). */
  readonly label?: string;
  readonly align?: "left" | "right";
  readonly headerClassName?: string;
  readonly cellClassName?: string;
}

/**
 * The table features DataTable registers. Build typed columns with
 * `createDataTableColumnHelper<Row>()` or type them as `DataTableColumnDef<Row>[]`.
 */
export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  filterFns: { includesString: filterFn_includesString },
  rowSelectionFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
  columnMeta: {} as DataTableColumnMeta,
});

export type DataTableFeatures = typeof dataTableFeatures;

export type DataTableColumnDef<TData extends RowData> = ColumnDef<
  DataTableFeatures,
  TData,
  // biome-ignore lint/suspicious/noExplicitAny: column value types differ per column.
  any
>;

/** A column helper bound to DataTable's features, for typed `accessor`/`display` columns. */
export function createDataTableColumnHelper<TData extends RowData>() {
  return createColumnHelper<DataTableFeatures, TData>();
}

/** Small checkbox used for row selection; supports the indeterminate state. */
function SelectCheckbox({
  checked,
  onToggle,
  label,
  disabled,
}: {
  readonly checked: boolean | "indeterminate";
  readonly onToggle: (event: unknown) => void;
  readonly label: string;
  readonly disabled?: boolean;
}) {
  return (
    <CheckboxPrimitive.Root
      checked={checked}
      disabled={disabled}
      aria-label={label}
      // Bind click (not change) so Shift-click range selection sees the modifier.
      onClick={(event) => {
        event.stopPropagation();
        onToggle(event);
      }}
      className={cn(
        "flex size-3.5 shrink-0 items-center justify-center rounded-sm border border-line-strong bg-input text-accent-fg",
        "transition-colors hover:border-fg-subtle",
        "data-[state=checked]:border-accent data-[state=checked]:bg-accent",
        "data-[state=indeterminate]:border-accent data-[state=indeterminate]:bg-accent",
        "disabled:cursor-not-allowed disabled:opacity-50",
        focusRing
      )}
    >
      <CheckboxPrimitive.Indicator className="flex">
        {checked === "indeterminate" ? (
          <Minus className="size-3" strokeWidth={3} />
        ) : (
          <Check className="size-3" strokeWidth={3} />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export interface DataTableProps<TData extends RowData> {
  readonly data: readonly TData[];
  readonly columns: readonly DataTableColumnDef<TData>[];
  /** Stable row id (e.g. the issue key); needed for selection to survive sorting and paging. */
  readonly getRowId?: (row: TData) => string;
  /** Adds a checkbox column with select-all in the header. */
  readonly enableRowSelection?: boolean;
  /** Called with the selected row ids after every change. */
  readonly onSelectionChange?: (ids: string[]) => void;
  /** Rendered in the toolbar while rows are selected (bulk actions). */
  readonly selectionActions?: (rows: TData[], clear: () => void) => ReactNode;
  /** Makes rows clickable (and focusable, Enter activates). */
  readonly onRowClick?: (row: TData) => void;
  /** Shows a search field that filters across all text columns. */
  readonly enableGlobalFilter?: boolean;
  readonly searchPlaceholder?: string;
  /** Shows the "View" menu to hide and show columns. */
  readonly enableColumnVisibility?: boolean;
  /** Extra controls at the right of the toolbar (e.g. a "New issue" button). */
  readonly toolbar?: ReactNode;
  readonly pageSize?: number;
  readonly pageSizeOptions?: readonly number[];
  /** Renders skeleton rows instead of data. */
  readonly loading?: boolean;
  /** Content of the single row shown when there is no data (or nothing matches). */
  readonly emptyState?: ReactNode;
  readonly stickyHeader?: boolean;
  readonly className?: string;
  /** Classes for the scroll container, e.g. `max-h-[480px]` with `stickyHeader`. */
  readonly containerClassName?: string;
}

/**
 * A full-featured table on TanStack Table 9: sortable headers, row selection with
 * select-all, column visibility, global search, pagination, loading and empty states,
 * and clickable rows. Columns are TanStack column definitions with `DataTableColumnMeta`.
 */
export function DataTable<TData extends RowData>({
  data,
  columns,
  getRowId,
  enableRowSelection = false,
  onSelectionChange,
  selectionActions,
  onRowClick,
  enableGlobalFilter = true,
  searchPlaceholder = "Filter…",
  enableColumnVisibility = true,
  toolbar,
  pageSize = 20,
  pageSizeOptions = [10, 20, 50, 100],
  loading = false,
  emptyState = "No results.",
  stickyHeader = false,
  className,
  containerClassName,
}: DataTableProps<TData>) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const allColumns = useMemo<DataTableColumnDef<TData>[]>(() => {
    if (!enableRowSelection) return [...columns];
    const select: DataTableColumnDef<TData> = {
      id: "select",
      enableSorting: false,
      enableHiding: false,
      enableGlobalFilter: false,
      header: ({ table }) => (
        <SelectCheckbox
          label="Select all rows"
          checked={
            table.getIsAllRowsSelected()
              ? true
              : table.getIsSomeRowsSelected()
                ? "indeterminate"
                : false
          }
          onToggle={table.getToggleAllRowsSelectedHandler()}
        />
      ),
      cell: ({ row }) => (
        <SelectCheckbox
          label="Select row"
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          onToggle={row.getToggleSelectedHandler()}
        />
      ),
    };
    return [select, ...columns];
  }, [columns, enableRowSelection]);

  const rows = useMemo(() => [...data], [data]);

  const table = useTable<DataTableFeatures, TData>({
    features: dataTableFeatures,
    columns: allColumns,
    data: rows,
    getRowId: getRowId ? (row) => getRowId(row) : undefined,
    enableRowSelection,
    globalFilterFn: "includesString",
    initialState: { pagination: { pageIndex: 0, pageSize } },
    state: { rowSelection },
    onRowSelectionChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(rowSelection) : updater;
      setRowSelection(next);
      onSelectionChange?.(Object.keys(next).filter((id) => next[id]));
    },
  });

  const visibleColumnCount = table.getVisibleLeafColumns().length;
  const pageRows = table.getRowModel().rows;
  const { pageIndex, pageSize: currentPageSize } = table.state.pagination;
  const selectedRows = enableRowSelection
    ? table.getSelectedRowModel().rows.map((row) => row.original)
    : [];
  const hideableColumns = table
    .getAllLeafColumns()
    .filter((column) => column.getCanHide());

  const showToolbar =
    enableGlobalFilter || enableColumnVisibility || toolbar || selectionActions;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {showToolbar ? (
        <div className="flex flex-wrap items-center gap-2">
          {enableGlobalFilter ? (
            <Input
              size="sm"
              aria-label="Filter rows"
              placeholder={searchPlaceholder}
              leading={<Search />}
              value={String(table.state.globalFilter ?? "")}
              onChange={(event) => table.setGlobalFilter(event.target.value)}
              className="w-56"
            />
          ) : null}
          {selectionActions && selectedRows.length > 0 ? (
            <div className="flex items-center gap-2 text-xs text-fg-muted">
              <span className="tabular-nums">
                {selectedRows.length} selected
              </span>
              {selectionActions(selectedRows, () =>
                table.resetRowSelection(true)
              )}
            </div>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            {toolbar}
            {enableColumnVisibility && hideableColumns.length > 0 ? (
              <DropdownMenuPrimitive.Root>
                <DropdownMenuPrimitive.Trigger asChild>
                  <Button size="sm" variant="secondary" icon={<Settings2 />}>
                    View
                  </Button>
                </DropdownMenuPrimitive.Trigger>
                <DropdownMenuPrimitive.Portal>
                  <DropdownMenuPrimitive.Content
                    align="end"
                    sideOffset={6}
                    className={cn(overlayContent, "min-w-44 p-1")}
                  >
                    <DropdownMenuPrimitive.Label className={menuLabel}>
                      Columns
                    </DropdownMenuPrimitive.Label>
                    {hideableColumns.map((column) => {
                      const header = column.columnDef.header;
                      const label =
                        column.columnDef.meta?.label ??
                        (typeof header === "string" ? header : column.id);
                      return (
                        <DropdownMenuPrimitive.CheckboxItem
                          key={column.id}
                          checked={column.getIsVisible()}
                          onCheckedChange={(value) =>
                            column.toggleVisibility(value)
                          }
                          onSelect={(event) => event.preventDefault()}
                          className={cn(menuItem, "pl-7")}
                        >
                          <DropdownMenuPrimitive.ItemIndicator className="absolute left-2 flex">
                            <Check />
                          </DropdownMenuPrimitive.ItemIndicator>
                          {label}
                        </DropdownMenuPrimitive.CheckboxItem>
                      );
                    })}
                  </DropdownMenuPrimitive.Content>
                </DropdownMenuPrimitive.Portal>
              </DropdownMenuPrimitive.Root>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-line">
        <Table
          stickyHeader={stickyHeader}
          containerClassName={containerClassName}
          aria-busy={loading || undefined}
        >
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => {
                  const meta = header.column.columnDef.meta;
                  const sorted = header.column.getIsSorted();
                  const canSort = header.column.getCanSort();
                  return (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      aria-sort={
                        sorted === "asc"
                          ? "ascending"
                          : sorted === "desc"
                            ? "descending"
                            : canSort
                              ? "none"
                              : undefined
                      }
                      className={cn(
                        meta?.align === "right" && "text-right",
                        meta?.headerClassName
                      )}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            "-mx-1.5 inline-flex h-6 items-center gap-1 rounded-sm px-1.5 transition-colors hover:bg-hover hover:text-fg",
                            sorted && "text-fg",
                            meta?.align === "right" && "flex-row-reverse",
                            focusRing
                          )}
                        >
                          <table.FlexRender header={header} />
                          {sorted === "asc" ? (
                            <ArrowUp className="size-3" />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="size-3" />
                          ) : (
                            <ChevronsUpDown className="size-3 text-fg-subtle" />
                          )}
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: Math.min(currentPageSize, 8) }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows have no identity.
                <TableRow key={`skeleton-${i}`} aria-hidden>
                  {table.getVisibleLeafColumns().map((column, c) => (
                    <TableCell key={column.id}>
                      <div
                        className="h-3 animate-shimmer rounded-sm bg-active"
                        style={{ width: `${45 + ((i * 7 + c * 13) % 45)}%` }}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : pageRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={visibleColumnCount}
                  className="h-24 text-center text-sm text-fg-muted"
                >
                  {emptyState}
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row) => (
                <TableRow
                  key={row.id}
                  selected={row.getIsSelected()}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={
                    onRowClick ? () => onRowClick(row.original) : undefined
                  }
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if (
                            event.key === "Enter" &&
                            event.target === event.currentTarget
                          ) {
                            onRowClick(row.original);
                          }
                        }
                      : undefined
                  }
                  className={cn(
                    onRowClick &&
                      "cursor-pointer outline-none focus-visible:bg-hover focus-visible:shadow-[inset_2px_0_0_var(--color-accent)]"
                  )}
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta;
                    return (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          meta?.align === "right" && "text-right",
                          meta?.cellClassName
                        )}
                      >
                        <table.FlexRender cell={cell} />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Pagination
        page={pageIndex + 1}
        pageCount={table.getPageCount()}
        onPageChange={(page) => table.setPageIndex(page - 1)}
        total={table.getFilteredRowModel().rows.length}
        pageSize={currentPageSize}
        pageSizeOptions={pageSizeOptions}
        onPageSizeChange={(size) => table.setPageSize(size)}
      />
    </div>
  );
}
