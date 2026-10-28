/**
 * Migrations are additive. A migration that drops or renames something needs an explicit
 * `-- contract: <reason>` line, so the destructive step is a reviewed decision.
 */
import { describe, expect, it } from "vitest";

import { filesUnder, read } from "./repo";

const migrations = filesUnder("packages/features/migrations", /\.sql$/);

describe("migrations", () => {
  it.each(migrations)("%s is additive or explains why not", (path) => {
    const sql = read(path);
    const destructive = /\b(DROP|RENAME)\b/i.test(sql);
    if (destructive) {
      expect(sql, "add a `-- contract: <reason>` line").toMatch(
        /^--\s*contract:\s*\S+/m
      );
    }
  });
});
