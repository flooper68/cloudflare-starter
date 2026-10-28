/** A random number in [0, 1), passed in so retry jitter stays testable and domain code pure. */
export interface Random {
  next(): number;
}
