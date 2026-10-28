import { Command } from "cmdk";
import { useControllableState } from "radix-ui/internal";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import type { controlSize } from "../lib/styles";
import { cn } from "../lib/utils";
import { Button } from "./button";
import {
  ComboboxInput,
  ComboboxMessage,
  type ComboboxOption,
  ComboboxOptions,
  comboboxList,
  type FieldControlProps,
  openOnArrowKeys,
  PickerTrigger,
} from "./combobox";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Spinner } from "./spinner";

/** Loads options for a search. Must reject (or stop) when `signal` aborts. */
export type OptionLoader = (
  query: string,
  signal: AbortSignal
) => Promise<readonly ComboboxOption[]>;

export interface AsyncOptionsState {
  /** `idle` until the query is long enough; `loading` keeps the previous options. */
  readonly status: "idle" | "loading" | "success" | "error";
  readonly options: readonly ComboboxOption[];
  readonly error: Error | null;
  /** Runs the last request again (after an error). */
  readonly retry: () => void;
}

export interface UseAsyncOptionsParams {
  readonly loader: OptionLoader;
  readonly query: string;
  /** Load only while true (e.g. while the panel is open). */
  readonly enabled?: boolean;
  readonly debounceMs?: number;
  /** Queries shorter than this (after trimming) do not load. */
  readonly minQueryLength?: number;
}

/**
 * Debounced, cancellable option loading. Each new query aborts the request in flight, so a
 * slow early response never overwrites a newer one.
 */
export function useAsyncOptions({
  loader,
  query,
  enabled = true,
  debounceMs = 200,
  minQueryLength = 0,
}: UseAsyncOptionsParams): AsyncOptionsState {
  const [state, setState] = useState<Omit<AsyncOptionsState, "retry">>({
    status: "idle",
    options: [],
    error: null,
  });
  const [attempt, setAttempt] = useState(0);
  const loaderRef = useRef(loader);

  useEffect(() => {
    loaderRef.current = loader;
  }, [loader]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` re-runs the request on retry.
  useEffect(() => {
    if (!enabled) return;
    const trimmed = query.trim();
    if (trimmed.length < minQueryLength) {
      setState({ status: "idle", options: [], error: null });
      return;
    }
    const controller = new AbortController();
    setState((previous) => ({ ...previous, status: "loading", error: null }));
    const timer = setTimeout(() => {
      loaderRef.current(trimmed, controller.signal).then(
        (options) => {
          if (!controller.signal.aborted) {
            setState({ status: "success", options, error: null });
          }
        },
        (error: unknown) => {
          if (controller.signal.aborted) return;
          setState({
            status: "error",
            options: [],
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      );
    }, debounceMs);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, enabled, debounceMs, minQueryLength, attempt]);

  return { ...state, retry: () => setAttempt((count) => count + 1) };
}

/** Idle, loading, error and empty messages for an async list; renders nothing otherwise. */
export function AsyncOptionsStatus({
  state,
  minQueryLength,
  emptyText,
  errorText,
}: {
  readonly state: AsyncOptionsState;
  readonly minQueryLength: number;
  readonly emptyText: ReactNode;
  readonly errorText: ReactNode;
}) {
  if (state.status === "idle" && minQueryLength > 0) {
    return (
      <ComboboxMessage>
        Type at least {minQueryLength} characters to search
      </ComboboxMessage>
    );
  }
  if (state.status === "loading" && state.options.length === 0) {
    return <ComboboxMessage>Searching…</ComboboxMessage>;
  }
  if (state.status === "error") {
    return (
      <ComboboxMessage>
        <span role="alert" className="text-danger">
          {errorText}
        </span>
        <Button size="xs" variant="secondary" onClick={state.retry}>
          Try again
        </Button>
      </ComboboxMessage>
    );
  }
  if (state.status === "success" && state.options.length === 0) {
    return <ComboboxMessage>{emptyText}</ComboboxMessage>;
  }
  return null;
}

export interface AsyncSelectProps extends FieldControlProps {
  /** `(query, signal) => Promise<ComboboxOption[]>`; called debounced while open. */
  readonly loader: OptionLoader;
  /** The selected option (options are not known up front, so the whole option is kept). */
  readonly value?: ComboboxOption | null;
  readonly defaultValue?: ComboboxOption | null;
  readonly onValueChange?: (option: ComboboxOption | null) => void;
  readonly open?: boolean;
  readonly defaultOpen?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly placeholder?: ReactNode;
  readonly searchPlaceholder?: string;
  readonly emptyText?: ReactNode;
  readonly errorText?: ReactNode;
  /** Do not search until the query has this many characters. */
  readonly minQueryLength?: number;
  readonly debounceMs?: number;
  readonly size?: keyof typeof controlSize;
  readonly disabled?: boolean;
  /** Choosing the selected option again clears the value. */
  readonly deselectable?: boolean;
  readonly className?: string;
  readonly contentClassName?: string;
}

/**
 * A Combobox whose options come from a loader, for lists too big to ship to the client
 * (people, issues). Requests are debounced (200ms) and cancelled when the query changes;
 * the list shows loading, empty and error (with retry) states.
 */
export function AsyncSelect({
  loader,
  value: valueProp,
  defaultValue = null,
  onValueChange,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No results",
  errorText = "Couldn't load results",
  minQueryLength = 0,
  debounceMs,
  size = "md",
  disabled,
  deselectable = false,
  className,
  contentClassName,
  ...fieldProps
}: AsyncSelectProps) {
  const [value, setValue] = useControllableState<ComboboxOption | null>({
    prop: valueProp,
    defaultProp: defaultValue,
    onChange: onValueChange,
  });
  const [open, setOpen] = useControllableState({
    prop: openProp,
    defaultProp: defaultOpen,
    onChange: onOpenChange,
  });
  const [search, setSearch] = useState("");
  const state = useAsyncOptions({
    loader,
    query: search,
    enabled: open,
    debounceMs,
    minQueryLength,
  });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setSearch("");
  }

  function select(option: ComboboxOption) {
    setValue(deselectable && option.value === value?.value ? null : option);
    handleOpenChange(false);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <PickerTrigger
          {...fieldProps}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          size={size}
          disabled={disabled}
          icon={value?.icon}
          placeholder={placeholder}
          className={className}
          onKeyDown={openOnArrowKeys(handleOpenChange)}
        >
          {value?.label}
        </PickerTrigger>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "w-(--radix-popover-trigger-width) min-w-60 p-0",
          contentClassName
        )}
      >
        <Command shouldFilter={false} loop>
          <ComboboxInput
            value={search}
            onValueChange={setSearch}
            placeholder={searchPlaceholder}
            trailing={
              state.status === "loading" ? <Spinner label="Loading" /> : null
            }
          />
          <Command.List
            className={comboboxList}
            aria-busy={state.status === "loading"}
          >
            <AsyncOptionsStatus
              state={state}
              minQueryLength={minQueryLength}
              emptyText={emptyText}
              errorText={errorText}
            />
            <ComboboxOptions
              options={state.options}
              isSelected={(option) => option.value === value?.value}
              onSelect={select}
            />
          </Command.List>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
