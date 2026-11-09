# How to publish the docs and the landing page

::reviewed{date="2026-11-09"}

The Worker serves a landing page at `/`, a docs site at `/docs` built from the repository's own Markdown, and a public 404, all prerendered at build time. Use this guide to add or move a doc, write one with screenshots and the docs components, change the landing page, or fix a failing docs check.

::flow[Markdown in the repository -> Build -> Static pages with search -> /docs]{title="Docs pipeline: the repository's Markdown is built into static pages with a search index, served at /docs"}

## Add, move or remove a doc

:::steps
1. **Write it** under `docs/` with a `# Title` first line (the page title and the navigation label).
2. **List it** in [docs/README.md](../README.md): a row in the right table, its link in the first cell. That row puts it in the navigation.
3. **Run `bun run test:unit`.** `test/architecture/docs.test.ts` fails when a doc is not in the navigation, a link or `#fragment` points at nothing, or a page has no title.
   :::

Write links as on GitHub (relative paths between files): the build rewrites them for the site. Moving a doc changes its URL.

:::prompt{title="Paste this into your coding agent"}
```text
Write a docs page for <feature> in the visual style: a screenshot with callouts, one flow,
settings cards, the one prompt, tabs for app / API / agent, decisions and gotchas, under
800 words. Add its screenshots to apps/web/test/screens/shots.ts, run
`bun run docs:screenshots`, list the page in docs/README.md and run the docs tests.
```
:::

## Screenshots and components

Docs are visual first. The components (`:::screenshot`, `:::steps`, `::flow`, `:::settings`, `:::tabs`, `:::prompt`, `:::byhand`, callouts, the video slot) are Markdown directives rendered at build time; screenshots come from `bun run docs:screenshots`, with callouts placed from element locators. Syntax and the pipeline: [docs components](../reference/docs-site.md#docs-components), [screenshots](../reference/docs-site.md#screenshots).

The landing clips and a doc's `::video` play walkthrough videos recorded with `bun run media:record`, uploaded to R2 with `bun run media:upload --env <env>` and served at `/media/`: [how-to-record-walkthrough-videos.md](how-to-record-walkthrough-videos.md).

## Generated reference pages

Settings, agent tools, catalogs and costs are generated from the code into marked blocks (`<!-- generated:name -->`). After changing a setting, a tool, a catalog or the home page's prices, run `bun run docs:reference`; a test fails while a block is out of date.

:::gotcha{title="The bundle budget"}
`bun run budget` fails when a page loads more than 50 KB of script. A new dependency in a page script, or a component hydrated on a public page, is the usual cause.
:::

## Reference

What is published, links and diagrams, the pages, the landing page and its motion, replacing it, the feature data and map, the roadmap, the changelog, theme, search, metadata, caching, the budget, checking locally and common problems: [Docs site reference](../reference/docs-site.md).
