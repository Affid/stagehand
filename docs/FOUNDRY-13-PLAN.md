# Foundry 13 support

Status: built 2026-11-10 (see "Built"). The owner approved the plan: our own
"Foundry has stopped" message, and no separate Foundry 13 note.

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

| #   | Where                      | 14.370                                                                                      | 13.351                                                                                    | Adjustment on 13                                                                                         |
| --- | -------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1   | Adapter                    | `v14` entry                                                                                 | none, so safe mode                                                                        | Add a `v13` entry (generation 13, builds up to 351), same selectors                                      |
| 2   | Certificates               | adminGenerateCertificates, adminReleaseCertificate                                          | missing ("Unsupported setup configuration action")                                        | Flag `certificates: false`; Configuration hides the certificate part, as it already can                  |
| 3   | Back up, then launch       | `game.createBackup` returns true when done                                                  | returns nothing, even on success (foundry.mjs 13:177344)                                  | Count the backup as done when Foundry's backup progress finishes without an error                        |
| 4   | Shut down                  | Setup menu has Shut down; `/quit` with `defer` answers, then Foundry's "shutting down" page | no menu button; `/quit` ignores `defer`, answers `failed` and stops at once; no quit page | Our confirm, then `/quit`, then our own "Foundry has stopped" message once `/api/status` stops answering |
| 5   | Edit module (context menu) | icon `fa-edit`                                                                              | icon `fa-pen-to-square`                                                                   | Find the item by either icon                                                                             |
| 6   | Create world               | goes to the /create page                                                                    | opens Foundry's world window inside Setup                                                 | Bring that window into view above our page, as we do for Install                                         |
| 7   | Configuration              | has Admin username and Unix socket                                                          | settings model has neither                                                                | Hide those two fields                                                                                    |
| 8   | Update check               | "site unreachable" is its own answer                                                        | an unreachable site reads as "no update"                                                  | Accept: a known, minor difference                                                                        |

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

To drop 13 later: delete `compat/v13/` and `test/compat/v13/`; in
`compat/quirks.ts` remove the three v13 imports, the `generation === 13`
branch and set `closeRefusedWorld` to null; remove the adapter entry from
`adapters/config.ts`. Everything else keeps working on 14. What stays
behind is general and harmless (the quirk fields with 14's values, the
"Foundry has stopped" screen); `tests/foundry/core.ts`'s ON_13 skips and
`setup-quit-13.spec.ts` can go too.

## Testing

- Unit tests for each override, against fakes shaped like 13's API.
- The live suites run on the private 13.351 server (port 30013) as well as
  14.370, since our page will open there. The world and companion tests on
  13 already exist; the Setup suites would run there for the first time.
- Library sync's live specs run on 13 too.

## Owner's decisions (2026-11-10)

1. Shut down on 13: our own confirm, then our own "Foundry has stopped"
   screen with a Reload button.
2. No separate Foundry 13 note: the version shows in Setup's header, and
   what 13 lacks is simply not offered.

## Built

- `compat/quirks.ts` (14's behaviour, `quirksFor`), `compat/v13/quirks.ts`,
  `compat/v13/adapter.ts`, `compat/v13/close-world.ts` (the app's 13 way of
  closing a running world, moved here); `adapters/selectors.ts` holds the
  selectors both adapters share, so the config and the 13 adapter don't
  import each other.
- Lint: only `compat/` and `adapters/config.ts` may import `compat/v13/`.
- Our page: Shut down opens our confirm on 13. Our quit counts Foundry as
  stopped only once its status route stops answering (a request that failed
  while Foundry still answers is not a stop); then the page world clears
  Foundry's notices, asks nothing more of it, and our page shows "Foundry
  has stopped" with a Reload button (`ui/shell/Stopped.tsx`, general, not
  13-only). Configuration hides Admin username and Unix socket, and the
  Advanced section reads "Advanced: compression".
- Live, opt-in: `tests/foundry/setup-quit-13.spec.ts` stops a private 13
  server for real (`ST_QUIT_13=1`; start the server again afterwards).
- Tests: `test/compat/v13/` (19). Live: the extension suite runs on 13.351;
  `tests/foundry/core.ts` reads the server's version so the specs expect
  the version they run against, and the three update tests that fake a newer
  14 build are skipped on 13 (13 is offered 14 itself). On 13.351 every
  spec passes except the same server-state failures 14 has (test world
  report, fixture counts). The changed specs pass on 14.370 too.
- Known Foundry 13 behaviour: right after a world is shut down through its
  join page, 13 is back on Setup before its databases have closed, and an
  immediate launch fails ("Database is not open"). The test scripts wait 5 s
  (`scripts/foundry/admin.ts`); a person relaunching within seconds of
  closing a world from the app could see Foundry's launch error once.
