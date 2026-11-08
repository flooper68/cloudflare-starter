# Anatomy of a feature

How one feature, the placeholder Notes app, plugs into every layer: components, screens, procedures, MCP tools, use cases, rules, tables and the catalogs that register it. Use when you add a feature and want to see the whole shape before following the steps in [how-to-add-a-feature.md](../guides/how-to-add-a-feature.md).

## Notes, layer by layer

```mermaid
flowchart TB
  accTitle: The Notes feature across the layers
  accDescr: In packages/ui, the NoteList and NoteEditor components. In the SPA, NotesPage and NoteDetailPage render them, are routed in routes.tsx and listed in navigation.ts and the command palette, and call the notes tRPC procedures. On the server, notesRouter holds workspace procedures and the MCP tools list_notes, create_note and the others call the same procedures in process. Each procedure calls one use case in packages/features/src/notes, such as createNote. The use cases apply the pure rules in notes/domain, ask the workspaces feature for the permission, billing for the notes limit, record audit events and track product events, and read and write the notes and note_comments tables in D1. The composition roots register the feature: database.ts its tables, trash-catalog.ts its trash entity, analytics-events.ts its event, data-catalog.ts its export and erasure, and billing's measure-metric.ts its countWorkspaceNotes measure.

  subgraph UI["packages/ui"]
    Components["NoteList, NoteEditor"]
  end

  subgraph SPA["apps/web SPA"]
    Screens["NotesPage, NoteDetailPage"]
    Nav["routes.tsx, navigation.ts, command palette"]
  end

  subgraph Server["apps/web/src/server"]
    Router["notesRouter: workspace procedures"]
    Tools["MCP tools: list_notes, create_note, ..."]
  end

  subgraph Feature["packages/features/src/notes"]
    UseCases["use cases: createNote, listNotes, trashNote, ..."]
    Domain["domain/: note-input, note-summary, errors, analytics-events"]
    Schema["notes.schema.ts"]
    Trash["trash.ts: noteTrash"]
  end

  subgraph Shared["other features"]
    Permission["workspaces: requirePermission"]
    Billing["billing: requireLimit notes"]
    Audit["audit: recordAuditEvent"]
    Analytics["product-analytics: trackEvent"]
  end

  subgraph Roots["composition roots"]
    Catalogs["database.ts, trash-catalog.ts, analytics-events.ts, data-catalog.ts, measure-metric.ts"]
  end

  D1[("D1: notes, note_comments")]

  Screens --> Components
  Nav --> Screens
  Screens -->|tRPC| Router
  Tools -->|createCaller| Router
  Router --> UseCases
  UseCases --> Domain
  UseCases --> Permission
  UseCases --> Billing
  UseCases --> Audit
  UseCases --> Analytics
  UseCases --> Schema
  Schema --> D1
  Catalogs --> Schema
  Catalogs --> Trash
  Catalogs --> Domain
```

The arrows follow the [layer rules](layers.md): screens never reach a use case except through a procedure, the MCP tools add no logic of their own, and the feature reaches other features only through their barrels. What the catalogs give the feature for free: the trash, export and erasure, the plan limit and analytics checks of `test/architecture/`. Code: [packages/features/src/notes/](../../packages/features/src/notes/), [notes-router.ts](../../apps/web/src/server/trpc/notes-router.ts), [mcp/tools.ts](../../apps/web/src/server/mcp/tools.ts), `apps/web/src/components/app/notes/`, `packages/ui/src/components/patterns/`. The steps, with the tests each needs: [how-to-add-a-feature.md](../guides/how-to-add-a-feature.md#steps-with-notes-as-the-example).
