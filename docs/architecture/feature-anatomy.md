# Anatomy of a feature

How one feature, the placeholder Notes app, plugs into every layer: components, screens, procedures, MCP tools, use cases, rules, tables and the catalogs that register it. Use when you add a feature and want to see the whole shape before following the steps in [how-to-add-a-feature.md](../guides/how-to-add-a-feature.md).

## Notes, layer by layer

![The Notes feature across the layers](diagrams/feature-anatomy.svg)

The arrows follow the [layer rules](layers.md): screens never reach a use case except through a procedure, the MCP tools add no logic of their own, and the feature reaches other features only through their barrels. What the catalogs give the feature for free: the trash, export and erasure, the plan limit and analytics checks of `test/architecture/`. Code: [packages/features/src/notes/](../../packages/features/src/notes/), [notes-router.ts](../../apps/web/src/server/trpc/notes-router.ts), [mcp/tools.ts](../../apps/web/src/server/mcp/tools.ts), `apps/web/src/components/app/notes/`, `packages/ui/src/components/patterns/`. The steps, with the tests each needs: [how-to-add-a-feature.md](../guides/how-to-add-a-feature.md#steps-with-notes-as-the-example).
