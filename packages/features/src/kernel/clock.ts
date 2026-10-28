/** The current time, passed to use cases so they stay testable and domain code stays pure. */
export interface Clock {
  now(): Date;
}
