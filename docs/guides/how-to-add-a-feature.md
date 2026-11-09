# How to add a feature

::reviewed{date="2026-11-09"}

Add a product feature end to end, with the placeholder **Notes** app as the worked example: its table, rules, use cases, permissions, plan limit, trash, audit events, product event, API, agent tools, screens and tests. Use this guide for a project's first real feature, to replace a placeholder app, or to review whether a feature is complete. What Notes looks like: [Notes: the feature to copy](../features/notes.md).

::flow[Table -> Use cases with permissions -> API and agent tools -> Screens -> Tests]{title="A feature, end to end: the table, use cases that check permissions, the API and agent tools, the screens, the tests"}

## The one prompt

:::prompt{title="Paste this into your coding agent"}
```text
Add a "<feature>" feature modelled on Notes: table, use cases with permissions, plan limit,
trash, audit and product events, privacy catalog, tRPC procedures, MCP tools, list and
detail screens with a palette search, and tests at every layer. Follow
docs/guides/how-to-add-a-feature.md and check it against docs/reference/adding-a-feature.md.
```
:::

## The steps

:::steps
1. **Model it:** a folder in `packages/features/src/<feature>/`, its tables with `workspace_id` on every row, domain rules with tests.
2. **Use cases:** one per action, each starting with `requirePermission(actor, "<feature>.<action>")`, then the plan's limit, the change, the audit event and the product event.
3. **Plug it in:** trash, the privacy catalog, tRPC procedures (`workspaceProcedure`), an MCP tool per procedure.
4. **Screens:** components with stories in `packages/ui`, pages and routes in the app, a sidebar entry, a palette search.
5. **Tests:** domain, integration against a real database, API (including cross-workspace denial), a browser journey.
   :::

:::decision{title="The architecture tests are the checklist"}
They fail when a feature misses its audit events, privacy catalog entries, trash support, rate limits, agent tools or workspace scoping, so "done" is what CI says.
:::

## Pages and the command palette

The sidebar, the top bar title and the palette's **Navigate** group all read one list, `apps/web/src/components/app/navigation.ts`: a new page adds its route and an entry there. A feature people look things up in adds a search provider, as Notes does ([searching from the palette](../reference/adding-a-feature.md#searching-from-the-command-palette)).

:::gotcha{title="Links between app pages route client-side"}
Use a router `<Link>` or `navigate()`, never a plain `<a href="/app/…">`: `test/architecture/spa-links.test.ts` fails on a full-page reload.
:::

## Reference

The placeholder apps, all seventeen steps as Notes does them, navigation and the palette, architecture tests, deploying a new table and removing Notes: [Adding a feature reference](../reference/adding-a-feature.md).
