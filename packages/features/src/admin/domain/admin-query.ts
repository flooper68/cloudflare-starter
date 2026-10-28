import { z } from "zod";

import { InvalidAdminQueryError } from "./errors";
import { PLATFORM_ROLES } from "./platform-role";

export const ADMIN_PAGE_SIZE_DEFAULT = 25;
export const ADMIN_PAGE_SIZE_MAX = 100;

const page = {
  /** `nextCursor` of the previous page. */
  cursor: z.string().min(1).max(400).optional(),
  limit: z
    .number()
    .int()
    .min(1)
    .max(ADMIN_PAGE_SIZE_MAX)
    .default(ADMIN_PAGE_SIZE_DEFAULT),
};

/** Filters of the admin user list: a search on name or email, platform role, status. */
export const adminUserQuerySchema = z
  .object({
    search: z.string().trim().max(200).optional(),
    role: z.enum(PLATFORM_ROLES).optional(),
    status: z.enum(["active", "banned"]).optional(),
    ...page,
  })
  .strict();
export type AdminUserQueryInput = z.input<typeof adminUserQuerySchema>;
export type AdminUserQuery = z.output<typeof adminUserQuerySchema>;

/** Filters of the admin workspace list: a search on the name, the kind. */
export const adminWorkspaceQuerySchema = z
  .object({
    search: z.string().trim().max(200).optional(),
    kind: z.enum(["personal", "shared"]).optional(),
    ...page,
  })
  .strict();
export type AdminWorkspaceQueryInput = z.input<
  typeof adminWorkspaceQuerySchema
>;
export type AdminWorkspaceQuery = z.output<typeof adminWorkspaceQuerySchema>;

/** Position after the last row of a page: rows are ordered by (createdAt, id) descending. */
export interface AdminCursor {
  readonly createdAtMs: number;
  readonly id: string;
}

/** Opaque to clients: `<epoch ms>:<id>`. */
export function encodeAdminCursor(cursor: AdminCursor): string {
  return `${cursor.createdAtMs}:${cursor.id}`;
}

export function decodeAdminCursor(value: string): AdminCursor {
  const separator = value.indexOf(":");
  const ms = value.slice(0, separator);
  const id = value.slice(separator + 1);
  if (separator < 1 || !/^\d+$/.test(ms) || id.length === 0) {
    throw new InvalidAdminQueryError("Invalid cursor");
  }
  return { createdAtMs: Number(ms), id };
}

/** `%`, `_` and `\` matched literally in a SQL LIKE pattern with `ESCAPE '\'`. */
export function likePattern(search: string): string {
  return `%${search.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/** Parses a list query, with the error the adapters map to BAD_REQUEST. */
export function parseAdminQuery<T extends z.ZodType>(
  schema: T,
  input: unknown
): z.output<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new InvalidAdminQueryError(
      `Invalid query: ${z.prettifyError(parsed.error)}`
    );
  }
  return parsed.data;
}
