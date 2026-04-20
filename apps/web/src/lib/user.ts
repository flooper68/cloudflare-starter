export function displayName(input: {
  readonly firstName?: string | null;
  readonly lastName?: string | null;
  readonly email?: string | null;
}): string {
  const name = [input.firstName, input.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (name) return name;
  return input.email ?? "there";
}
