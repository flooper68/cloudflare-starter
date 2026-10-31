import { DomainError } from "./domain-error";

/** Small raster images only: declared MIME must agree with the magic bytes. */
export function profileImageType(
  bytes: Uint8Array,
  declared: string
): "image/png" | "image/jpeg" | "image/webp" {
  if (bytes.byteLength === 0 || bytes.byteLength > 1024 * 1024)
    throw new DomainError(
      "invalid_input",
      "Choose an image no larger than 1 MB",
      "INVALID_PROFILE_IMAGE"
    );
  const is = (offset: number, values: readonly number[]) =>
    values.every((v, i) => bytes[offset + i] === v);
  const actual = is(0, [137, 80, 78, 71, 13, 10, 26, 10])
    ? "image/png"
    : is(0, [255, 216, 255])
      ? "image/jpeg"
      : is(0, [82, 73, 70, 70]) && is(8, [87, 69, 66, 80])
        ? "image/webp"
        : null;
  if (!actual || actual !== declared)
    throw new DomainError(
      "invalid_input",
      "Choose a PNG, JPEG or WebP image",
      "INVALID_PROFILE_IMAGE"
    );
  return actual;
}
