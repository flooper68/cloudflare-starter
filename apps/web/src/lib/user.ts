export function displayName(input: {
  readonly name?: string | null;
  readonly email?: string | null;
}): string {
  const name = input.name?.trim();
  if (name) return name;
  return input.email ?? "there";
}

export function initials(input: {
  readonly name?: string | null;
  readonly email: string;
}): string {
  const fromName =
    input.name
      ?.split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("") ?? "";

  return (fromName || input.email.slice(0, 2)).toUpperCase();
}
