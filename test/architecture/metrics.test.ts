/**
 * The metric catalog is the only source of metric names (docs/guides/how-to-setup-metrics-
 * and-tracing.md): every `.counter(…)`, `.upDownCounter(…)` and `.histogram(…)` in server
 * code names a catalog metric of that kind, every catalog metric is recorded somewhere, and
 * the attribute keys passed to `.add(…)`/`.record(…)` on such an instrument are keys its
 * catalog entry lists. Catalog entries themselves (names, units, buckets, no id attributes)
 * are checked by packages/features/src/platform/metric-catalog.test.ts.
 */
import ts from "typescript";
import { describe, expect, it } from "vitest";

import {
  METRIC_CATALOG,
  type MetricDefinition,
} from "../../packages/features/src/platform/metric-catalog";
import { filesUnder, read } from "./repo";

const CATALOG = METRIC_CATALOG as Readonly<Record<string, MetricDefinition>>;
const INSTRUMENTS = new Set(["counter", "upDownCounter", "histogram"]);

/** Server code that records metrics: features and the web app, tests and contracts aside. */
const sourceFiles = [
  ...filesUnder("packages/features/src", /\.ts$/),
  ...filesUnder("apps/web/src", /\.ts$/),
].filter((path) => !/\.(test|contract|integration\.test)\.ts$/.test(path));

interface Use {
  readonly file: string;
  readonly kind: string;
  readonly name: string;
  readonly attributeKeys: readonly string[];
}

/** Keys of an object literal, following spreads of same-file `const x = { … }`. */
function objectKeys(
  node: ts.Expression,
  source: ts.SourceFile,
  seen = new Set<string>()
): string[] {
  let expression = node;
  while (
    ts.isAsExpression(expression) ||
    ts.isSatisfiesExpression(expression) ||
    ts.isParenthesizedExpression(expression)
  ) {
    expression = expression.expression;
  }
  if (ts.isIdentifier(expression)) {
    if (seen.has(expression.text)) return [];
    seen.add(expression.text);
    let found: ts.Expression | undefined;
    const visit = (child: ts.Node) => {
      if (
        ts.isVariableDeclaration(child) &&
        ts.isIdentifier(child.name) &&
        child.name.text === expression.text &&
        child.initializer
      ) {
        found = child.initializer;
      }
      ts.forEachChild(child, visit);
    };
    visit(source);
    return found ? objectKeys(found, source, seen) : [];
  }
  if (!ts.isObjectLiteralExpression(expression)) return [];
  return expression.properties.flatMap((property) => {
    if (ts.isSpreadAssignment(property))
      return objectKeys(property.expression, source, seen);
    const name = property.name;
    if (name && (ts.isStringLiteral(name) || ts.isIdentifier(name)))
      return [name.text];
    return [];
  });
}

function usesIn(file: string): Use[] {
  const source = ts.createSourceFile(
    file,
    read(file),
    ts.ScriptTarget.Latest,
    true
  );
  const uses: Use[] = [];
  const visit = (node: ts.Node) => {
    // metrics.histogram("name") — optionally followed by .record(value, { … })
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      INSTRUMENTS.has(node.expression.name.text) &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0] as ts.Node)
    ) {
      const parent = node.parent;
      const recordCall =
        ts.isPropertyAccessExpression(parent) &&
        ["add", "record"].includes(parent.name.text) &&
        ts.isCallExpression(parent.parent)
          ? parent.parent
          : undefined;
      const attributes = recordCall?.arguments[1];
      uses.push({
        file,
        kind: node.expression.name.text,
        name: (node.arguments[0] as ts.StringLiteral).text,
        attributeKeys: attributes ? objectKeys(attributes, source) : [],
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return uses;
}

const uses = sourceFiles.flatMap(usesIn);

describe("metric names and attributes", () => {
  it("finds metric uses in server code", () => {
    expect(uses.length).toBeGreaterThan(0);
  });

  it.each(uses.map((use) => [`${use.file}: ${use.name}`, use] as const))(
    "%s is a catalog metric of that kind with catalog attribute keys",
    (_, use) => {
      const definition = CATALOG[use.name];
      expect(
        definition,
        `add "${use.name}" to METRIC_CATALOG in packages/features/src/platform/metric-catalog.ts`
      ).toBeDefined();
      expect(definition?.kind).toBe(use.kind);
      const unknown = use.attributeKeys.filter(
        (key) => !definition?.attributes.includes(key)
      );
      expect(
        unknown,
        `attribute keys not in the catalog entry of ${use.name}`
      ).toEqual([]);
    }
  );

  it.each(Object.keys(CATALOG))(
    "catalog metric %s is recorded somewhere",
    (name) => {
      expect(
        uses.some((use) => use.name === name),
        `nothing records ${name}: remove it from the catalog or record it`
      ).toBe(true);
    }
  );
});
