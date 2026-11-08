# How to start a project from the starter

From this template to your own app, deployed. Use when you create a new product from the template, or when you want to know what `bun run starter:strip` removes.

## Start with one prompt

Open a coding agent (Claude Code or similar) in an empty folder, paste this, and replace `<name>` with the app's name:

```text
Create a new agent-native app called <name> from the template https://github.com/flooper68/cloudflare-starter. Read its AGENTS.md first, then follow its start-project skill (.claude/skills/start-project/SKILL.md). Ask me for each decision it needs, and before every change to my GitHub or Cloudflare account.
```

The agent follows the `start-project` skill ([.claude/skills/start-project/SKILL.md](../../.claude/skills/start-project/SKILL.md)): it checks the prerequisites (Bun, the GitHub CLI signed in, Wrangler logged in), creates your repository from the template, strips the starter-only parts, brands the app, runs the setup scripts and makes the first deploy. It asks you for each decision and before every change to your GitHub or Cloudflare account; you type secrets yourself.

::flow[Create the repository -> Strip -> Brand -> Set up -> First deploy]{title="Starting a project: create the repository, strip the starter-only parts, brand it, set it up, deploy"}

## What the strip removes

The parts that exist only for the starter's own public instance: the automated QA suite, the production values, the marketing and changelog history, the name, the public demo, the developer demos and the Container demo. Each is listed with why it exists in [starter-only.json](../../starter-only.json); `bun run starter:strip` asks which to keep. The full table: [what the strip removes](../reference/start-a-project.md#what-the-strip-removes).

:::byhand
The seven steps the skill runs (create the repository, strip, brand, set up Cloudflare and auth, first deploy, decide what the starter's pages become, keep or replace the placeholders): [doing it by hand](../reference/start-a-project.md#doing-it-by-hand).
:::

:::gotcha{title="When the strip fails"}
It refuses to run when the manifest no longer matches the code and names the component. In the starter that is a bug: report it ([what to do](../reference/start-a-project.md#when-the-strip-fails)).
:::
