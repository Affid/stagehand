# Stagehand companion module

The Foundry VTT module (`stagehand`) that works with Stagehand's Setup
page. Stagehand's Setup page, in the browser extension or the Android app,
can't see inside a world. The companion runs inside the world, reports the
world's active modules to Setup and applies the module changes you queued
there, after showing them to you.

On its own it does nothing. Install the Stagehand extension from the
[Chrome Web Store](https://chromewebstore.google.com/detail/iilpkngpgiiocbmnnjkhmehaadnpknac)
or the Android app too (see the [main README](../../README.md)).

## Install

Stagehand's Setup page offers to install it on a server that doesn't have
it. By hand: in Foundry's Install Module window, paste the manifest URL:

```
https://raw.githubusercontent.com/Affid/stagehand/manifests/stagehand/module.json
```

Then turn it on in each world you manage with Stagehand. Foundry VTT 13
and 14.

## What it does

- Runs only for the full Gamemaster. When several are online, only the
  one with the lowest user id runs it, so a change is never applied twice.
  Players and Assistant GMs: nothing runs.
- On each join it writes a report to the world's flags: the active
  modules with their versions, and the Foundry and system versions.
- When Setup queued changes, it plans them against the live world and
  shows a dialog: Apply & reload, Not now, or Discard. A launch you already
  reviewed on Setup applies without asking, if nothing changed since.
- It turns modules on and off through Foundry's own module configuration,
  then reloads once. It always keeps itself on.

## What it touches

- Writes: the running world's `flags.stagehand` in `world.json`, and core's
  module configuration setting when a change is applied.
- Reads: the world's modules, users, versions and settings, and the
  server's clock (`/api/status`).
- Network: only the Foundry server it runs on. No other host, no
  telemetry.

## Development

The source is TypeScript in `src`, bundled with the parts of
`../shared` it uses into `dist/stagehand.js` (Vite, not minified).

```bash
pnpm --filter @stagehand/module build   # -> packages/module/dist
pnpm test packages/module               # its unit tests (from the repository root)
pnpm foundry:link                       # links dist into a local Foundry's Data/modules
```

| File               | Role                                                                    |
| ------------------ | ----------------------------------------------------------------------- |
| `index.ts`         | Entry point on Foundry's `ready` hook; wiring and the first-GM check    |
| `foundry.ts`       | The few Foundry APIs used, typed narrowly                               |
| `gamemaster.ts`    | Which Gamemaster runs the session                                       |
| `world-session.ts` | One join: read the flags, settle the last change, report or apply, save |
| `apply.ts`         | Plan, ask, record, write the module configuration, reload               |
| `dialog.ts`        | The confirmation dialog; escapes every value it shows                   |
| `world-state.ts`   | Reads the live world; builds the plan and the module configuration      |
| `world-io.ts`      | Saves the flags (Foundry's `editWorld`) and reads the server clock      |

`static` holds `module.json` and `lang/en.json`, copied into `dist` as
they are.

- [docs/COMPANION-GUIDE.md](../../docs/COMPANION-GUIDE.md): the developer
  guide: running it, the code, one join step by step, making changes,
  tests.
- [docs/COMPANION-WORLD-PROTOCOL.md](../../docs/COMPANION-WORLD-PROTOCOL.md):
  what Setup and the companion leave each other in the world's flags.
- Releases: `pnpm release:companion <version>`, see
  [CONTRIBUTING.md](../../CONTRIBUTING.md). The tag is
  `stagehand-v<version>` and must match `static/module.json`.
