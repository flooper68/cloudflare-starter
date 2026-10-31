/** A composition-root registration; unrecognized keys are never deletion candidates. */
export interface StorageReferenceSource {
  readonly matches: (key: string) => boolean;
  /** Includes live, trashed and pending references. Failures must propagate. */
  readonly referenced: (
    keys: readonly string[]
  ) => Promise<ReadonlySet<string>>;
}
