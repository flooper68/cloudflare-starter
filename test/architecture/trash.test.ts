/**
 * Trash (docs/guides/how-to-use-trash.md): a trashed row must never leak into a live read.
 * - Every table of TRASH_CATALOG has `deleted_at` and `deleted_by` and the partial index
 *   `(workspace_id, deleted_at) WHERE deleted_at IS NOT NULL`.
 * - Every feature file that reads such a table (`db.query.<t>`, `.from(<t>)`,
 *   `<t>.workspaceId`) scopes the read with `liveIn` or `trashedIn`, or is listed below
 *   with the reason it may see both.
 */
import { describe, expect, it } from "vitest";

import { TRASH_CATALOG } from "../../packages/features/src";

import { filesUnder, read } from "./repo";

/** Feature files that read a trashable table without liveIn/trashedIn: path → reason. */
const UNSCOPED_READS: Readonly<Record<string, string>> = {
  "packages/features/src/files/trash.ts":
    "the files entity of the trash catalog: purge deletes the ids its caller chose (trashedIn, retention, account erasure)",
  "packages/features/src/files/delete-workspace-files.ts":
    "account erasure deletes every file of a workspace being deleted, live or trashed, bypassing the trash",
  "packages/features/src/files/measure-workspace-storage.ts":
    "storage_bytes counts trashed files until they are purged (R2 still stores them)",
};

const migrationSql = filesUnder("packages/features/migrations", /\.sql$/)
  .map(read)
  .join("\n");

const schemaFiles = filesUnder("packages/features/src", /\.schema\.ts$/);

/** The variable a table is declared as (`export const files = sqliteTable("files", …)`). */
function variableOf(tableName: string): string {
  for (const path of schemaFiles) {
    const match = read(path).match(
      new RegExp(`export const (\\w+) = sqliteTable\\(\\s*"${tableName}"`)
    );
    if (match?.[1]) return match[1];
  }
  throw new Error(`No sqliteTable("${tableName}") in a *.schema.ts`);
}

const trashable = TRASH_CATALOG.map((entity) => {
  // Drizzle keeps the SQL name under this symbol (getTableName; drizzle-orm is not a root dependency).
  const table = String(
    (entity.table as unknown as Record<symbol, unknown>)[
      Symbol.for("drizzle:Name")
    ]
  );
  return { type: entity.type, table, variable: variableOf(table) };
});

/** Whether `source` reads the table declared as `variable`. */
function readsTable(source: string, variable: string): boolean {
  return new RegExp(
    `\\bdb\\.query\\.${variable}\\b|\\.from\\(\\s*${variable}\\s*\\)|\\b${variable}\\.workspaceId\\b`
  ).test(source);
}

const scoped = (source: string) => /\b(liveIn|trashedIn)\(/.test(source);

const featureSources = filesUnder("packages/features/src", /\.ts$/).filter(
  (path) =>
    !/\.test\.ts$/.test(path) &&
    !/\.schema\.ts$/.test(path) &&
    path !== "packages/features/src/database.ts"
);

describe("trash", () => {
  it("has a catalog", () => {
    expect(trashable.map((entry) => entry.type)).toContain("file");
  });

  it.each(trashable)(
    "table $table has deleted_at, deleted_by and the partial trash index",
    ({ table }) => {
      const body =
        migrationSql.match(
          new RegExp(`CREATE TABLE \`${table}\` \\(([\\s\\S]*?)\\n\\);`)
        )?.[1] ?? "";
      expect(body).toMatch(/`deleted_at` integer,/);
      expect(body).toMatch(/`deleted_by` text,/);
      expect(body).toMatch(
        /FOREIGN KEY \(`deleted_by`\) REFERENCES `user`\(`id`\) ON UPDATE no action ON DELETE set null/
      );
      expect(migrationSql).toMatch(
        new RegExp(
          `CREATE INDEX \`\\w+\` ON \`${table}\` \\(\`workspace_id\`,\`deleted_at\`\\) WHERE "${table}"."deleted_at" IS NOT NULL`
        )
      );
    }
  );

  it.each(trashable)(
    "every read of $table outside the trash is scoped with liveIn or trashedIn",
    ({ variable }) => {
      const unscoped = featureSources.filter((path) => {
        const source = read(path);
        return (
          readsTable(source, variable) &&
          !scoped(source) &&
          !(path in UNSCOPED_READS)
        );
      });
      expect(
        unscoped,
        "filter with liveIn(table, actor) (or trashedIn), or list the file in UNSCOPED_READS with a reason"
      ).toEqual([]);
    }
  );

  it("lists only files that read a trashable table, each with a reason", () => {
    for (const [path, reason] of Object.entries(UNSCOPED_READS)) {
      const source = read(path);
      expect(
        trashable.some(({ variable }) => readsTable(source, variable)),
        path
      ).toBe(true);
      expect(reason.trim().length, path).toBeGreaterThan(10);
    }
  });

  it("recognises the reads it guards", () => {
    expect(readsTable("db.query.files.findMany({", "files")).toBe(true);
    expect(readsTable(".select().from(files).where(", "files")).toBe(true);
    expect(readsTable("eq(files.workspaceId, id)", "files")).toBe(true);
    expect(readsTable(".from(filesArchive)", "files")).toBe(false);
    expect(readsTable(".insert(files).values(", "files")).toBe(false);
  });
});
