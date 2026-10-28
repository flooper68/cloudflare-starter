/**
 * One concept per file, for the server: every use-case file in a feature exports exactly
 * one runtime value (its function). Types and interfaces do not count.
 */
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { filesUnder, read } from "./repo";

/** Top-level files of a feature folder, other than its barrel, schema and tests. */
const useCaseFiles = filesUnder(
  "packages/features/src",
  /^packages\/features\/src\/(?!kernel\/|platform\/)[^/]+\/(?!index\.ts$)[^/]+(?<!\.schema|\.test|\.integration\.test)\.ts$/
);

function runtimeExports(path: string): string[] {
  const source = ts.createSourceFile(
    path,
    read(path),
    ts.ScriptTarget.Latest,
    true
  );
  const names: string[] = [];
  for (const statement of source.statements) {
    const exported = ts.canHaveModifiers(statement)
      ? ts
          .getModifiers(statement)
          ?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
      : false;
    if (ts.isFunctionDeclaration(statement) && exported) {
      names.push(statement.name?.text ?? "default");
    } else if (ts.isClassDeclaration(statement) && exported) {
      names.push(statement.name?.text ?? "default");
    } else if (ts.isVariableStatement(statement) && exported) {
      for (const declaration of statement.declarationList.declarations) {
        names.push(declaration.name.getText(source));
      }
    } else if (ts.isExportDeclaration(statement) && !statement.isTypeOnly) {
      const clause = statement.exportClause;
      if (clause && ts.isNamedExports(clause)) {
        for (const element of clause.elements) {
          if (!element.isTypeOnly) names.push(element.name.text);
        }
      } else {
        names.push("*");
      }
    }
  }
  return names;
}

describe("use cases", () => {
  it("finds use-case files", () => {
    expect(useCaseFiles.length).toBeGreaterThan(0);
  });

  it.each(useCaseFiles)("%s exports exactly one runtime value", (path) => {
    expect(
      runtimeExports(path),
      "split it: one use case per file"
    ).toHaveLength(1);
  });
});
