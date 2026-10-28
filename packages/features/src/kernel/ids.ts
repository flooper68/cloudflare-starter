/** Identifier generator, passed to use cases instead of calling crypto directly. */
export interface Ids {
  uuid(): string;
}
