/**
 * The MCP parity rule: anything the app can do over HTTP, an MCP client can do too.
 * A new tRPC procedure needs a tool (tools.ts) or an MCP_EXEMPT_PROCEDURES entry with
 * a reason; a new non-tRPC endpoint needs a NON_TRPC_ROUTES entry with a reason.
 */
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  MCP_EXEMPT_PROCEDURES,
  MCP_TOOLS,
  NON_TRPC_ROUTES,
  PROCEDURE_PATHS,
  procedureInput,
} from "./tools";

const PAGES = fileURLToPath(new URL("../../pages", import.meta.url));

/** Endpoint files (.ts) under src/pages; .astro pages render HTML and are not API. */
function endpointFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return endpointFiles(path);
    return name.endsWith(".ts") && !name.endsWith(".test.ts")
      ? [relative(PAGES, path)]
      : [];
  });
}

describe("MCP parity", () => {
  it("exposes every tRPC procedure as a tool or lists why not", () => {
    const covered = new Set(MCP_TOOLS.flatMap((tool) => tool.procedures));
    const missing = PROCEDURE_PATHS.filter(
      (path) => !covered.has(path) && !(path in MCP_EXEMPT_PROCEDURES)
    );
    expect(missing, "add an MCP tool in tools.ts or an exemption").toEqual([]);
  });

  it("names only real procedures in tools and exemptions", () => {
    const known = new Set(PROCEDURE_PATHS);
    const unknown = [
      ...MCP_TOOLS.flatMap((tool) => tool.procedures),
      ...Object.keys(MCP_EXEMPT_PROCEDURES),
    ].filter((path) => !known.has(path));
    expect(unknown).toEqual([]);
  });

  it("does not both expose and exempt a procedure", () => {
    const covered = new Set(MCP_TOOLS.flatMap((tool) => tool.procedures));
    expect(
      Object.keys(MCP_EXEMPT_PROCEDURES).filter((path) => covered.has(path))
    ).toEqual([]);
  });

  it("lists every non-tRPC endpoint with a reason", () => {
    const unlisted = endpointFiles(PAGES).filter(
      (file) => !(file in NON_TRPC_ROUTES)
    );
    expect(unlisted, "route it through tRPC or add NON_TRPC_ROUTES").toEqual(
      []
    );
    const stale = Object.keys(NON_TRPC_ROUTES).filter(
      (file) => !endpointFiles(PAGES).includes(file)
    );
    expect(stale, "remove NON_TRPC_ROUTES entries for deleted files").toEqual(
      []
    );
  });

  it("gives every exemption a reason", () => {
    for (const reason of [
      ...Object.values(MCP_EXEMPT_PROCEDURES),
      ...Object.values(NON_TRPC_ROUTES),
    ]) {
      expect(reason.trim().length).toBeGreaterThan(10);
    }
  });

  it("uses unique snake_case tool names with descriptions", () => {
    const names = MCP_TOOLS.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
    for (const tool of MCP_TOOLS) {
      expect(tool.name).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(tool.description.length).toBeGreaterThan(20);
    }
  });

  it("takes the procedure's own input in single-procedure tools", () => {
    for (const tool of MCP_TOOLS.filter((t) => t.procedures.length === 1)) {
      const [path] = tool.procedures;
      expect(Object.keys(tool.input.shape)).toEqual(
        Object.keys(procedureInput(path as string).shape)
      );
    }
  });
});
