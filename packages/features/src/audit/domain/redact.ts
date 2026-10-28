/**
 * Metadata keys that suggest a credential. The catalog's `.strict()` schemas already refuse
 * undeclared keys; this is the second line: no catalog entry may declare such a key, and
 * recordAuditEvent refuses metadata that contains one at any depth.
 */
export const SECRET_KEY_PATTERN = /token|password|secret|code/i;

/** Paths (`a.b`) of every key in `value` that matches SECRET_KEY_PATTERN. */
export function findSecretKeys(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      findSecretKeys(item, `${path}[${index}]`)
    );
  }
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const childPath = path ? `${path}.${key}` : key;
    return [
      ...(SECRET_KEY_PATTERN.test(key) ? [childPath] : []),
      ...findSecretKeys(child, childPath),
    ];
  });
}
