const encoder = new TextEncoder();

/**
 * Compares a presented secret with the expected one in constant time: the loop always
 * runs over every byte of `expected` and folds the differences (and a length mismatch)
 * into one value, so how long it takes depends only on the expected secret's length, never
 * on where the first wrong character is. Pass the secret the caller sent first and the
 * configured one second.
 */
export function timingSafeEqual(presented: string, expected: string): boolean {
  const left = encoder.encode(presented);
  const right = encoder.encode(expected);
  let difference = left.length ^ right.length;
  for (let index = 0; index < right.length; index++) {
    difference |= (left[index] ?? 0) ^ (right[index] as number);
  }
  return difference === 0 && right.length > 0;
}
