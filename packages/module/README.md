# Stagehand companion module

The Foundry VTT module (`stagehand`) that works with Stagehand's Setup
page. Stagehand's Setup page, in the browser extension or the Android app,
can't see inside a world. The companion runs inside the world, reports the
world's active modules to Setup and applies the module changes you queued
there, after showing them to you. Inside a world it also shows the
server's Stagehand library in Module Management: modules as cards in the
library's folders, each module's details, presets, and a review before
saving.

Without Stagehand's Setup page it adds nothing: the changes come from
Setup, and the library view needs the library the server's admin
organises there. Install the Stagehand extension from the
[Chrome Web Store](https://chromewebstore.google.com/detail/iilpkngpgiiocbmnnjkhmehaadnpknac)
or the Android app too (see the [main README](../../README.md)).

## Install

Stagehand's Setup page offers to install it on a server that doesn't have
it. By hand: in Foundry's Install Module window, search for
**Stagehand** (it is in [Foundry's package list](https://foundryvtt.com/packages/stagehand)),
or paste the manifest URL:

```
https://raw.githubusercontent.com/Affid/stagehand/manifests/stagehand/module.json
```

Then turn it on in each world you manage with Stagehand. Foundry VTT 13
and 14.

## What it does

- Reports and applies only for the full Gamemaster. When several are
  online, only the one with the lowest user id does, so a change is never
  applied twice.
- On each join it writes a report to the world's flags: the active
  modules with their versions, and the Foundry and system versions.
- When Setup queued changes, it plans them against the live world and
  shows a dialog: Apply & reload, Not now, or Discard. A launch you already
  reviewed on Setup applies without asking, if nothing changed since.
- It turns modules on and off through Foundry's own module configuration,
  then reloads once. It always keeps itself on.
- In Module Management, for Gamemasters and Assistant GMs on a server with
  a Stagehand library: the library's folders as cards, each module's
  details, Apply preset (full Gamemasters), and a review before saving.
  Players keep Foundry's own list. Each user can turn it off in Configure
  Settings: "Library view in Module Management".
- With BBMM's own module manager on, the first full Gamemaster is asked
  once which view Module Management opens in that world.

## What it touches

- Writes: the running world's `flags.stagehand` in `world.json`; core's
  module configuration setting when a change is applied or saved; its own
  settings (the per-user library view, and the world's answer to the BBMM
  question); BBMM's "Enable enhanced module management", only when a
  Gamemaster chooses Stagehand's view there; and the user's Group by and
  folded sections in the browser's local storage.
- Reads: the world's modules, users, versions and settings, the server's
  clock (`/api/status`), and the library file Setup keeps on the server
  (`Data/stagehand/library.json`), which it never changes.
- Network: only the Foundry server it runs on. No other host, no
  telemetry.

## Development

The source is TypeScript in `src`, bundled with the parts of
`../shared` and `../ui` it uses (Vite, not minified): `dist/stagehand.js`,
the library view's chunk `dist/stagehand-mount-*.js`, which loads only when
a Gamemaster opens Module Management, the code both share, and
`dist/stagehand-view.css`.

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
| `manage/`          | Module Management: setting, library file, take-over, save guard, BBMM   |
| `view/`            | The library view's chunk: view, unsaved changes, review, Apply Preset   |

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
