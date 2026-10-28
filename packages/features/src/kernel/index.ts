// Pure building blocks shared by every feature's domain: no I/O, no dependencies.
export type { Clock } from "./clock";
export { DomainError, type DomainErrorKind } from "./domain-error";
export type { Ids } from "./ids";
