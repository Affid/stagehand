# Foundry 13 support

Status: proposal, 2026-11-10, for the owner's approval. Nothing built yet.

## Why Setup doesn't run on 13 today

Our Setup page takes over only when an adapter matches the running core
(`adapters/select.ts`). The bundled config has a 14 adapter only, so 13.351
falls into safe mode, and in safe mode the page deliberately leaves
Foundry's own Setup alone (`ui/shell/mount.tsx`). The companion already
works on 13 (COMPANION-WORLD-PROTOCOL.md), and library sync's server side
does too (LIBRARY-SYNC-PLAN.md spike).

## What differs (checked in 13.351 and 14.370 code)

Most of Setup is identical on 13: the markup our adapter selects, the
world and module data, `game.post`, backups and snapshots, progress events,
the editor element, the file picker, notifications, editWorld, lockPackage,
update check and download, disk space checks, and the CSS variables our
page uses. The differences that matter:

| # | Where | 14.370 | 13.351 | Adjustment on 13 |
|---|---|---|---|---|
| 1 | Adapter | `v14` entry | none, so safe mode | Add a `v13` entry (generation 13, builds up to 351), same selectors |
| 2 | Certificates | adminGenerateCertificates, adminReleaseCertificate | missing ("Unsupported setup configuration action") | Flag `certificates: false`; Configuration hides the certificate part, as it already can |
| 3 | Back up, then launch | `game.createBackup` returns true when done | returns nothing, even on success (foundry.mjs 13:177344) | Count the backup as done when Foundry's backup progress finishes without an error |
| 4 | Shut down | Setup menu has Shut down; `/quit` with `defer` answers, then Foundry's "shutting down" page | no menu button; `/quit` ignores `defer`, answers `failed` and stops at once; no quit page | Our confirm, then `/quit`, then our own "Foundry has stopped" message once `/api/status` stops answering |
| 5 | Edit module (context menu) | icon `fa-edit` | icon `fa-pen-to-square` | Find the item by either icon |
| 6 | Create world | goes to the /create page | opens Foundry's world window inside Setup | Bring that window into view above our page, as we do for Install |
| 7 | Configuration | has Admin username and Unix socket | settings model has neither | Hide those two fields |
| 8 | Update check | "site unreachable" is its own answer | an unreachable site reads as "no update" | Accept: a known, minor difference |

Already handled elsewhere: closing a running world (13 refuses
`worldShutdown`; the app's running page already uses `/join` shutdown,
`app/running/server.ts`), joining as a user (`userid` on 13), and
`getPackages` (Foundry's own `game.getPackages` hides the answer's shape).

## Keeping it discardable

All 13-only code lives in one place, so dropping 13 is deleting a folder,
one adapter entry and one import:

```
packages/extension/src/compat/
  quirks.ts          the interface our code calls, with 14's behaviour
  v13/
    quirks.ts        13's overrides of that interface
    adapter.ts       the v13 adapter entry (selectors, flags)
packages/extension/test/compat/v13/
                     unit tests for every override
```

- Our code keeps calling one thing, `quirksFor(release)`, for the few
  places that differ (backup result, quit, edit-module icon, create-world
  window, hidden settings, closing a running world). It returns 14's
  behaviour unless the core's generation is 13.
- Feature switches that already exist in the adapter config (such as
  `certificates`) stay there, as data.
- A lint rule (`no-restricted-imports`) allows only `compat/quirks.ts` and
  the bundled config to import from `compat/v13/`, so 13 code can't spread.
  No `generation === 13` checks anywhere else.
- The app's existing 13 branch for closing a running world moves into the
  same folder.

To drop 13 later: delete `compat/v13/` and its tests, remove the import
from `compat/quirks.ts` and the adapter entry, and the lint rule keeps
anything from being left behind.

## Testing

- Unit tests for each override, against fakes shaped like 13's API.
- The live suites run on the private 13.351 server (port 30013) as well as
  14.370, since our page will open there. The world and companion tests on
  13 already exist; the Setup suites would run there for the first time.
- Library sync's live specs run on 13 too.

## Decisions for the owner

1. Shut down on 13 (item 4): our own short "Foundry has stopped" message,
   since 13 has no quit page. Or hide Shut down on 13.
2. Whether a 13 server shows any sign that it is on the older version (for
   example a quiet "Foundry 13" note), or looks exactly like 14.
