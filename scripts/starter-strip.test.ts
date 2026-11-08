import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { parse } from "jsonc-parser";
import { afterEach, describe, expect, it } from "vitest";

import {
  type Component,
  editJsonc,
  editSection,
  inRunOrder,
  jobRange,
  markStripped,
  type Manifest,
  nextSteps,
  planComponent,
  removeStarterNotes,
  selectComponents,
  stepRange,
  validateManifest,
} from "./starter-strip-lib";

const WRANGLER = `{
  "name": "app",
  "vars": {
    "KEEP": "yes",
    // About DROP only.
    // Second line.
    "DROP": "on",
    "LAST": "x"
  },
  "ratelimits": [
    { "name": "RL_A", "namespace_id": "1" },
    { "name": "RL_B", "namespace_id": "2" }
  ],
  "env": {
    "production": {
      // The route.
      "routes": [{ "pattern": "starter.example", "custom_domain": true }],
      "vars": { "KEEP": "yes", "DROP": "on" },
      "ratelimits": [{ "name": "RL_B", "namespace_id": "3" }]
    }
  }
}
`;

const WORKFLOW = `name: CI

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - run: bun run lint

  # Starter only.
  strip:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v1
      # Packages the extra Worker.
      - name: Extra
        working-directory: apps/extra
        run: bun run deploy:dry-run
      - name: Keep
        run: echo ok

  build:
    runs-on: ubuntu-latest
`;

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true });
});

function repo(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "starter-strip-test-"));
  roots.push(root);
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), content);
  }
  return root;
}

function component(overrides: Partial<Component>): Component {
  return {
    id: "demo",
    title: "Demo",
    why: "Only the starter needs it.",
    status: "active",
    default: true,
    ...overrides,
  };
}

/** Plans, applies and plans again: the second plan must have nothing to do. */
function strip(root: string, parts: Component[], params = {}) {
  const actions = inRunOrder(
    parts.flatMap((part) => planComponent(root, part, params).actions)
  );
  for (const action of actions.filter((a) => !a.done)) action.run();
  const again = parts.flatMap(
    (part) => planComponent(root, part, params).actions
  );
  expect(again.filter((action) => !action.done)).toEqual([]);
}

describe("editJsonc", () => {
  it("removes a setting with its own comment and keeps every other comment", () => {
    const next = editJsonc(WRANGLER, ["vars", "DROP"], { comment: null });
    const config = parse(next) as {
      vars: Record<string, string>;
      env: { production: { vars: Record<string, string> } };
    };
    expect(config.vars).toEqual({ KEEP: "yes", LAST: "x" });
    expect(config.env.production.vars.DROP).toBe("on");
    expect(next).not.toContain("About DROP");
    expect(next).not.toContain("Second line");
    expect(next).toContain('"KEEP": "yes"');
    expect(next).toContain("// The route.");
    expect(editJsonc(next, ["vars", "DROP"], { comment: null })).toBe(next);
  });

  it("sets a value and replaces the comment above it, once", () => {
    const next = editJsonc(WRANGLER, ["env", "production", "routes"], {
      value: [{ pattern: "app.example.com", custom_domain: true }],
      comment: "Your hostname.",
    });
    expect(next).toContain("// Your hostname.");
    expect(next).not.toContain("// The route.");
    expect(next).toContain("app.example.com");
    expect(
      editJsonc(next, ["env", "production", "routes"], {
        value: [{ pattern: "app.example.com", custom_domain: true }],
        comment: "Your hostname.",
      })
    ).toBe(next);
  });

  it("leaves a missing setting alone", () => {
    expect(editJsonc(WRANGLER, ["vars", "NOPE"], {})).toBe(WRANGLER);
  });
});

describe("Markdown sections", () => {
  const doc = [
    "# Guide",
    "",
    "Intro.",
    "",
    "## Keep",
    "",
    "Kept.",
    "",
    "## Drop",
    "",
    "```sh",
    "# not a heading",
    "```",
    "",
    "### Drop detail",
    "",
    "Gone too.",
    "",
    "## After",
    "",
    "Stays.",
    "",
  ].join("\n");

  it("removes a section with its subsections, ignoring # in code", () => {
    const next = editSection(doc, "Drop");
    expect(next).not.toContain("Drop detail");
    expect(next).not.toContain("not a heading");
    expect(next).toContain("## After");
    expect(editSection(next, "Drop")).toBe(next);
  });

  it("replaces only the intro of a section", () => {
    const next = editSection(doc, "Guide", "# Guide\n\nNew intro.", true);
    expect(next).toContain("New intro.");
    expect(next).not.toContain("Intro.\n");
    expect(next).toContain("## Keep");
    expect(editSection(next, "Guide", "# Guide\n\nNew intro.", true)).toBe(
      next
    );
  });

  it("removes the starter-only notes of one component", () => {
    const text = [
      "Before.",
      "",
      "> **Starter-only, removed by `starter:strip`** (`demo`): the demo.",
      "> More of it.",
      "",
      "> **Starter-only, removed by `starter:strip`** (`other`): stays.",
      "",
      "After.",
    ].join("\n");
    const next = removeStarterNotes(text, "demo");
    expect(next).not.toContain("the demo");
    expect(next).not.toContain("More of it");
    expect(next).toContain("(`other`)");
    expect(next).toContain("Before.\n\n> **Starter-only");
  });
});

describe("workflow jobs and steps", () => {
  it("finds a job with its comment and a step with its comment", () => {
    const lines = WORKFLOW.split("\n");
    const job = jobRange(WORKFLOW, "strip") as [number, number];
    expect(lines.slice(job[0], job[1]).join("\n")).toMatch(
      /^ {2}# Starter only\.\n {2}strip:[\s\S]*echo ok$/
    );
    const step = stepRange(WORKFLOW, "strip", "Extra") as [number, number];
    expect(lines.slice(step[0], step[1])).toEqual([
      "      # Packages the extra Worker.",
      "      - name: Extra",
      "        working-directory: apps/extra",
      "        run: bun run deploy:dry-run",
    ]);
    expect(jobRange(WORKFLOW, "nope")).toBeNull();
    expect(stepRange(WORKFLOW, "strip", "Nope")).toBeNull();
  });
});

describe("planComponent", () => {
  it("strips every kind of change, and a second run finds nothing to do", () => {
    const root = repo({
      "apps/web/wrangler.jsonc": WRANGLER,
      "package.json": '{\n  "scripts": { "keep": "a", "drop": "b" }\n}\n',
      ".github/workflows/ci.yml": WORKFLOW,
      "docs/guide.md": "# Guide\n\n## Drop\n\nGone.\n\n## Keep\n\nKept.\n",
      "README.md":
        "# Old name\n\nText.\n\n> **Starter-only, removed by `starter:strip`** (`demo`): x.\n",
      "src/name.ts": 'export const NAME = "Old name";\n',
      "src/extra.ts": "export {};\n",
      "CHANGELOG.md": "# Changelog\n\nold history\n",
    });
    const part = component({
      delete: ["src/extra.ts"],
      wrangler: [{ env: "all", path: ["vars", "DROP"], comment: null }],
      rateLimits: ["RL_B"],
      json: [{ file: "package.json", path: ["scripts", "drop"] }],
      ci: [
        { workflow: ".github/workflows/ci.yml", job: "strip" },
        { workflow: ".github/workflows/ci.yml", job: "lint", step: "Nope" },
      ],
      docs: [{ file: "docs/guide.md", action: "remove", heading: "Drop" }],
      text: [{ file: "src/name.ts", find: "Old name", replace: "{{name}}" }],
      files: [{ file: "CHANGELOG.md", content: "# Changelog\n\n{{name}}\n" }],
    });
    strip(root, [part], { name: "Acme" });

    const read = (file: string) => readFileSync(join(root, file), "utf8");
    expect(existsSync(join(root, "src/extra.ts"))).toBe(false);
    expect(read("apps/web/wrangler.jsonc")).not.toContain("DROP");
    expect(read("apps/web/wrangler.jsonc")).not.toContain("RL_B");
    expect(read("apps/web/wrangler.jsonc")).toContain("RL_A");
    expect(read("package.json")).not.toContain("drop");
    expect(read(".github/workflows/ci.yml")).not.toContain("strip:");
    expect(read(".github/workflows/ci.yml")).toContain("  build:");
    expect(read("docs/guide.md")).not.toContain("Gone.");
    expect(read("README.md")).not.toContain("Starter-only");
    expect(read("src/name.ts")).toContain('"Acme"');
    expect(read("CHANGELOG.md")).toBe("# Changelog\n\nAcme\n");
  });

  it("leaves what needs a missing name to the owner", () => {
    const root = repo({ "src/name.ts": 'export const NAME = "Old name";\n' });
    const { actions, skipped } = planComponent(
      root,
      component({
        text: [{ file: "src/name.ts", find: "Old name", replace: "{{name}}" }],
      }),
      {}
    );
    expect(actions).toEqual([]);
    expect(skipped).toHaveLength(1);
  });

  it("applies a patch once and refuses one that no longer applies", () => {
    const root = repo({
      "src/a.ts": "one\ntwo\nthree\n",
      "starter-only/a.patch": [
        "diff --git a/src/a.ts b/src/a.ts",
        "--- a/src/a.ts",
        "+++ b/src/a.ts",
        "@@ -1,3 +1,2 @@",
        " one",
        "-two",
        " three",
        "",
      ].join("\n"),
    });
    const part = component({ patch: "starter-only/a.patch" });
    strip(root, [part]);
    expect(readFileSync(join(root, "src/a.ts"), "utf8")).toBe("one\nthree\n");
    writeFileSync(join(root, "src/a.ts"), "changed\n");
    expect(() => planComponent(root, part, {})).toThrow(/no longer applies/);
  });
});

describe("manifest", () => {
  const manifest: Manifest = {
    components: [
      component({ id: "a" }),
      component({ id: "b", default: false }),
      component({ id: "c", status: "pending", pending: "#1" }),
    ],
  };

  it("selects the defaults, --only and --keep", () => {
    const ids = (parts: Component[]) => parts.map((part) => part.id);
    expect(ids(selectComponents(manifest, {}))).toEqual(["a", "c"]);
    expect(ids(selectComponents(manifest, { keep: ["a"] }))).toEqual(["c"]);
    expect(ids(selectComponents(manifest, { only: ["b"] }))).toEqual(["b"]);
    expect(() => selectComponents(manifest, { only: ["x"] })).toThrow(
      /Unknown component "x"/
    );
  });

  it("reports a malformed component", () => {
    expect(validateManifest(manifest)).toEqual([]);
    expect(
      validateManifest({
        components: [
          component({ id: "Bad id", why: "" }),
          component({ id: "p", status: "pending" }),
        ],
      })
    ).toEqual([
      "Bad id: id must be kebab-case",
      "Bad id: no why",
      "p: pending needs the PR it waits for",
    ]);
  });

  it("marks stripped components in the manifest file", () => {
    const root = repo({
      "starter-only.json": `${JSON.stringify(manifest, null, 2)}\n`,
    });
    markStripped(root, ["a"]);
    const after = JSON.parse(
      readFileSync(join(root, "starter-only.json"), "utf8")
    ) as Manifest;
    expect(after.components.map((part) => part.status)).toEqual([
      "stripped",
      "active",
      "pending",
    ]);
  });

  it("prints secrets as commands to run by hand", () => {
    expect(
      nextSteps([
        component({
          secrets: [{ name: "TOKEN", where: ["develop", "production"] }],
          manual: ["Do it."],
        }),
      ])
    ).toEqual([
      "Delete the Worker secret TOKEN of develop, if it was set: bunx wrangler secret delete TOKEN (in apps/web).",
      "Delete the Worker secret TOKEN of production, if it was set: bunx wrangler secret delete TOKEN --env production (in apps/web).",
      "Do it.",
    ]);
  });
});
