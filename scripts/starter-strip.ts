/**
 * `bun run starter:strip [--apply] [--yes] [--only <ids>] [--keep <ids>] [--name <name>]
 * [--repo-url <url>] [--list] [--skip-checks]`
 *
 * Removes the parts of the starter that exist only for its own public instance (its QA
 * automation, demos, marketing, production config, ...), as listed in starter-only.json.
 * Dry run by default: prints every file it would delete or change. --apply does it, then
 * runs `bun install`, typecheck and lint and prints the next steps. Interactive unless
 * --yes (agents: --yes with --only/--keep). Idempotent: a second run finds nothing to do.
 * Never contacts Cloudflare or GitHub; secrets to delete are printed as commands.
 * docs/guides/how-to-start-a-project.md
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";

import { ask, ROOT } from "./lib";
import {
  type Action,
  type Component,
  inRunOrder,
  markStripped,
  nextSteps,
  type Params,
  planComponent,
  readManifest,
  selectComponents,
  validateManifest,
} from "./starter-strip-lib";

const { values } = parseArgs({
  options: {
    apply: { type: "boolean", default: false },
    yes: { type: "boolean", short: "y", default: false },
    only: { type: "string" },
    keep: { type: "string" },
    name: { type: "string" },
    "repo-url": { type: "string" },
    list: { type: "boolean", default: false },
    "skip-checks": { type: "boolean", default: false },
    root: { type: "string" },
    "in-starter": { type: "boolean", default: false },
  },
});

const root = values.root ? resolve(values.root) : ROOT;
const ids = (value: string | undefined) =>
  value
    ?.split(",")
    .map((id) => id.trim())
    .filter(Boolean) ?? [];

const manifest = readManifest(root);
const problems = validateManifest(manifest);
if (problems.length) {
  console.error(`starter-only.json is not valid:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}

// Applied in the starter's own repository it would delete the starter's QA and demos.
if (
  values.apply &&
  originSlug() === "flooper68/cloudflare-starter" &&
  !values["in-starter"]
) {
  console.error(
    "This is the starter's own repository (origin flooper68/cloudflare-starter): create a repository from the template and strip that (docs/guides/how-to-start-a-project.md). To strip a checkout of the starter anyway, add --in-starter."
  );
  process.exit(1);
}

if (values.list) {
  for (const component of manifest.components)
    console.log(
      `${component.id.padEnd(26)} ${component.status.padEnd(8)} ${component.default ? "strip" : "keep "}  ${component.title}`
    );
  process.exit(0);
}

let selected: Component[];
try {
  selected = selectComponents(manifest, {
    only: ids(values.only),
    keep: ids(values.keep),
  });
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}

const interactive = !values.yes && process.stdin.isTTY;
if (interactive) {
  console.log(
    "Starter-only parts (docs/guides/how-to-start-a-project.md). Enter keeps the default.\n"
  );
  const chosen: Component[] = [];
  for (const component of manifest.components) {
    if (component.status !== "active") continue;
    const preselected = selected.includes(component);
    console.log(`${component.title} (${component.id})\n  ${component.why}`);
    const answer = (
      await ask(`  Strip it? [${preselected ? "Y/n" : "y/N"}] > `)
    ).toLowerCase();
    if (answer === "" ? preselected : answer.startsWith("y"))
      chosen.push(component);
  }
  selected = chosen;
}

const params: { name?: string; repoUrl?: string } = {
  name: values.name,
  repoUrl: values["repo-url"] ?? originUrl(),
};
const needs = (key: keyof Params) =>
  selected.some((component) =>
    JSON.stringify(component).includes(`{{${key}}}`)
  );
if (interactive && needs("name") && !params.name)
  params.name =
    (await ask(
      "Project name (docs title, mail sender name; Enter skips) > "
    )) || undefined;
if (interactive && needs("repoUrl") && !params.repoUrl)
  params.repoUrl =
    (await ask(
      "Repository URL, https://github.com/<owner>/<repo> (Enter skips) > "
    )) || undefined;

const plans: { component: Component; actions: Action[]; skipped: string[] }[] =
  [];
for (const component of selected) {
  if (component.status === "pending") {
    console.log(
      `- ${component.id}: pending (${component.pending}); not on main yet, nothing to strip`
    );
    continue;
  }
  try {
    plans.push({ component, ...planComponent(root, component, params) });
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }
}

const todo = inRunOrder(
  plans.flatMap((plan) => plan.actions.filter((a) => !a.done))
);
console.log(
  `\n${values.apply ? "Stripping" : "Dry run (add --apply to do it)"}: ${plans.map((p) => p.component.id).join(", ") || "nothing selected"}\n`
);
for (const plan of plans) {
  const open = plan.actions.filter((action) => !action.done);
  console.log(
    `${plan.component.title} (${plan.component.id})${open.length ? "" : ": already stripped"}`
  );
  for (const action of open) console.log(`  ${action.description}`);
  for (const line of plan.skipped) console.log(`  by hand: ${line}`);
}

if (!values.apply) {
  console.log(
    `\n${todo.length} change(s). Nothing was changed. Run again with --apply.`
  );
  printNextSteps();
  process.exit(0);
}

for (const action of todo) action.run();
markStripped(
  root,
  plans
    .filter((plan) => plan.component.status === "active")
    .map((plan) => plan.component.id)
);
console.log(`\n✓ ${todo.length} change(s) applied.`);

if (!values["skip-checks"]) {
  for (const command of [
    ["bun", "install"],
    ["bun", "run", "lint:fix"],
    ["bun", "run", "typecheck"],
    ["bun", "run", "lint"],
  ]) {
    console.log(`\n$ ${command.join(" ")}`);
    const result = spawnSync(command[0] as string, command.slice(1), {
      cwd: root,
      stdio: "inherit",
    });
    if (result.status !== 0) {
      console.error(
        `\n${command.join(" ")} failed after the strip: fix it, or report the manifest entry (starter-only.json).`
      );
      process.exit(1);
    }
  }
}
printNextSteps();

function printNextSteps() {
  const steps = nextSteps(plans.map((plan) => plan.component));
  console.log("\nNext steps (docs/guides/how-to-start-a-project.md):");
  for (const step of [
    ...steps,
    "Run the setup scripts: bun run setup:cloudflare, setup:auth, setup:email, setup:secrets, then bun run doctor.",
    "Run bun run verify && bun run build, and commit the strip on its own.",
  ])
    console.log(`- ${step}`);
}

/** `<owner>/<repo>` of the origin remote on GitHub, if there is one. */
function originSlug(): string | undefined {
  const result = spawnSync("git", ["remote", "get-url", "origin"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, GIT_CEILING_DIRECTORIES: dirname(root) },
  });
  const url = result.stdout?.trim() ?? "";
  return /github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/.exec(url)?.[1];
}

/** The repository's own URL, from the origin remote, unless it is the starter's. */
function originUrl(): string | undefined {
  const slug = originSlug();
  if (!slug || slug === "flooper68/cloudflare-starter") return undefined;
  return `https://github.com/${slug}`;
}
