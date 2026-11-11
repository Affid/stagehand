# Stagehand shared code

The code the companion module, the extension and the app's web part all
use: data formats, validation and the logic that must give the same answer
everywhere. Nothing here talks to Foundry or the browser directly, so all
of it is unit-tested without either.

Not published on its own. The other packages import its source
(`@stagehand/shared/<file>`) and bundle what they use.

| File or folder    | What it holds                                                                |
| ----------------- | ---------------------------------------------------------------------------- |
| `world-flags.ts`  | What Setup and the companion leave each other in a world's flags; validated  |
| `resolver.ts`     | The apply plan: what turns on and off, dependencies, conflicts (`resolver/`) |
| `version.ts`      | Version comparison and compatibility, mirroring Foundry core                 |
| `package.ts`      | Package data as the library uses it, with its schemas                        |
| `package-read.ts` | Reads Foundry's live package objects defensively, without Zod                |
| `world.ts`        | World snapshots and commands                                                 |
| `protocol.ts`     | Messages between the extension's scripts and its background                  |
| `library/`        | The module library: its schema, operations, merge across devices, sync file  |
| `organise/`       | Grouping, filtering and usage counts for the Library page                    |
| `news.ts`         | Foundry's News and Featured Content on Setup                                 |
| `log.ts`          | The one place that writes to the console                                     |
| `zod-config.ts`   | Imported first by every entry point: Zod without `new Function`              |

Everything read from outside (flags, files, Foundry's data) is treated as
untrusted: checked field by field and bounded in size.

```bash
pnpm test packages/shared   # its unit tests (from the repository root)
```

- [docs/COMPANION-WORLD-PROTOCOL.md](../../docs/COMPANION-WORLD-PROTOCOL.md):
  the flags' format.
- [docs/LIBRARY-SYNC-PLAN.md](../../docs/LIBRARY-SYNC-PLAN.md): the library
  file and the merge.
- [docs/PRD.md](../../docs/PRD.md): the requirements the code refers to by
  id.
