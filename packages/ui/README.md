# Stagehand shared UI

The modules view that two pages show: Setup's world page and Library, in
the [extension](../extension/README.md) and the app, and Module Management
inside a running world, drawn by the [companion](../module/README.md).
Module cards in folder sections, the module panel with its Library and
Package tabs, their models, widgets, strings and styles. Preact.

Not published on its own. The other packages import its source
(`@stagehand/ui/<file>`) and bundle what they use. It builds on
[`@stagehand/shared`](../shared/README.md) and talks to neither Foundry nor
the browser's extension APIs.

## The context

A page gives the view what it needs through one Preact context,
`ModulesUi` (`context.ts`): the translator, the data (`ModulesData`, from
`model/data.ts`), what the user may do, the view's grouping and layout,
the open module and the actions. Each page provides it its own way:

| `where`   | Page                                   | Provider                                   |
| --------- | -------------------------------------- | ------------------------------------------ |
| `"setup"` | Setup: every world, the library edited | `packages/extension/src/ui/modules-ui.tsx` |
| `"world"` | Module Management: this world only     | `packages/module/src/view/App.tsx`         |

`canSwitch` turns modules on and off, `canOrganise` edits folders, tags and
notes (Setup only). On Setup a switch queues a change for the world's next
launch; inside a world it marks a change that waits for Save, kept as a
local command that `model/` reads as it reads a world's queue.

| Folder or file | What it holds                                                                                 |
| -------------- | --------------------------------------------------------------------------------------------- |
| `context.ts`   | `ModulesUi`, the context each page provides                                                   |
| `world/`       | The modules tab: cards and one-line rows in groups, their "why" line, Turn all                |
| `panel/`       | The module panel: Library tab (Setup's, or the read-only one in a world), Package tab         |
| `model/`       | The view's models: grouping, a world's modules after its changes, active presets, world order |
| `common/`      | Widgets and keyboard behaviour: modal, popover, tabs, safe links                              |
| `i18n.ts`      | The translator: the server's language, else the browser's, else English                       |
| `strings/`     | `en.json`: the strings of the Setup page and of this view                                     |
| `css/`         | Seven style sheets under the root class `.st-ui`; each page reads them in order               |

```bash
pnpm test packages/ui   # its unit tests (from the repository root)
```

Most of its behaviour is also tested through the pages that use it: the
extension's tests for Setup, the companion's `view-*` tests for a world.

- [docs/IN-WORLD-LIBRARY-PLAN.md](../../docs/IN-WORLD-LIBRARY-PLAN.md): why
  the view was moved here from the extension, and how a world uses it.
- [docs/SETUP-REDESIGN.md](../../docs/SETUP-REDESIGN.md): the design of the
  world page, the Library and the module panel.
