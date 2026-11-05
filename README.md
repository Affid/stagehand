# Module Library for Foundry VTT (working name)

Organise installed Foundry VTT modules on the Setup screen (folders, tags,
notes, smart groups, authors), see which modules each world uses, and apply
presets to a world in **add**, **replace** or **remove** mode with a diff
preview. The design is in [docs/PRD.md](docs/PRD.md).

Two parts, as the PRD describes:

- **Browser extension** (`packages/extension`): enhances the Setup page and
  holds the library, world snapshots and the command queue.
- **Companion module** (`packages/module`, id `module-library`): runs inside
  each world for the full Gamemaster, reports the world's modules and applies
  queued changes after confirmation.
- **Shared logic** (`packages/shared`): protocol, schemas, the library model
  and the apply resolver, used by both.

Status: M0 spike and M1 (MVP) on Foundry V14. See
[docs/M1-STATUS.md](docs/M1-STATUS.md) for what is done and what is open.

## Development

Requirements: Node 22.18+, pnpm 12, a local Foundry (see below).

```bash
pnpm install
pnpm build            # extension -> packages/extension/dist, module -> packages/module/dist
pnpm test             # unit tests (Vitest)
pnpm test:coverage    # with the 80% threshold
pnpm lint && pnpm typecheck && pnpm format:check
pnpm verify           # all of the above
```

Load the extension unpacked from `packages/extension/dist` (Chrome:
`chrome://extensions`, developer mode). Open its options page, add your
server URL (for example `http://localhost:30000`) and grant the permission.

## Local Foundry

Settings come from `.env.local` (copy `.env.example`): Foundry's app and data
folders, port and administrator password. The same Foundry install serves the
ModularAV project.

```bash
pnpm foundry:start    # runs Foundry (V14 Node build) in the foreground
pnpm build && pnpm foundry:link   # links the module and test fixtures into Data/modules
pnpm foundry:setup    # creates the module-library-test world and its users, safe to repeat
pnpm test:foundry     # end-to-end suites against the running Foundry (~5 minutes)
```

The test world has `Gamemaster` (full GM), `Assistant` (Assistant GM) and
`Player1`, all without passwords. `fixtures/modules` holds three tiny test
modules: a library, a module that requires it, and one that conflicts with it.

## Layout

```
packages/shared      protocol, Zod schemas, version logic, resolver, library ops
packages/extension   background, Setup adapters, Setup UI (Preact), bridge, options
packages/module      companion module: session, apply flow, dialog
scripts/foundry      local Foundry helpers (admin API, world setup, linking)
tests/foundry        Playwright end-to-end suites (Setup UI, in-world apply)
docs                 PRD, M0 findings, M1 status
```
