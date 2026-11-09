# The companion through the world (plan)

Status: decided 2026-11-09; the spike passed on Foundry 13.351 and 14.370
(see "Spike results"). Build not started.

## Why

Today the companion talks only to the Stagehand extension or app in the
Gamemaster's own browser (the page bridge: HELLO, SNAPSHOT_PUSH,
COMMANDS_PULL, COMMAND_ACK). Without it the companion says "no browser
extension found" once and does nothing. So:

- a Gamemaster who joins from a browser without the extension, or from a
  phone, reports no modules and applies no queued changes;
- the Android app never shows the game (phase 7), so an app-only setup
  never learns a world's modules (found on the emulator: "Modules
  unknown"), unless it joins out of sight;
- the queue lives in one browser's (or the app's) storage: changes queued
  on the desktop are invisible to the app, and the other way round.

The owner asked (2026-11-09): can the companion work on its own and leave
something on the server that the extension and app read whenever they
want?

## The idea

The world's own `world.json` carries the exchange, in its `flags`, as our
session schedule already does:

- **Setup writes the queue** into `flags.stagehand` with Foundry's world
  edit (the `editWorld` request our Setup page already uses for the world's
  details and schedule).
- **The companion reads it** when any full Gamemaster joins, from any
  browser, applies it (without asking when it was reviewed on Setup, with
  its dialog otherwise, as today), and **writes back a report**: the
  world's active modules and each change's result. A Gamemaster in a
  running world may make the same world edit: Foundry 14.370's server
  allows `editWorld` from a user with the Gamemaster role while the world
  runs (`setup.mjs`, checked in its code), and it saves `world.json`.
- **Setup reads the report** whenever it likes, with no game open and no
  bridge: Foundry's Setup data carries each world's flags (we read the
  schedule from there today).

Only one side writes at a time: while the world runs, only the companion
(Setup isn't open); while it doesn't, only Setup.

The library (folders, tags, notes, presets) stays where it is, in each
browser and in the app. A queued change is written into the world already
expanded (its mode and module ids), as the background expands it for the
companion today (`expandForWorld`), so the companion needs no library.

## What the world carries

`world.json` → `flags.stagehand` (validated on both sides; nothing in it is
trusted):

| Field      | Written by | What                                                                                                                                                                                            |
| ---------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `v`        | both       | The format's version; a side that sees a newer major leaves it alone and says so.                                                                                                               |
| `queue`    | Setup      | The changes waiting for the next Gamemaster: each `{id, mode, modules, presets (names, for the dialog), queuedAt}`. At most 50.                                                                 |
| `launch`   | Setup      | This launch's intent: `{kind: "reviewed", target, at}` (Apply and launch: no dialog when the live result matches) or `{kind: "hold", at}` (Launch without changes). Used once by the companion. |
| `report`   | companion  | `{at, coreVersion, systemVersion, active: [{id, version}], results: [{id, status, error?}]}`: what Setup shows as the world's modules, and what happened to each queued change.                 |
| `schedule` | Setup      | Unchanged (today's next-session schedule).                                                                                                                                                      |

Sizes stay small: module ids at most 200 characters, results only for the
last launch, and every save under 90 KB, because Foundry refuses a request
body over 100 KB (HTTP 413, measured on both versions). `active` is written
compactly (`"id@version"` strings, about 40 bytes each, so about 2000
modules per save); a world with more is written without versions, and the
report says so.

`launch` is honoured once, and only when it was written shortly before the
world started. Both sides use the server's clock, not their own: Setup
stamps `at` from the `Date` header of its save's answer, and the companion
takes the world's start from `/api/status` (`uptime`) and the `Date` header
of that answer. A device and a Gamemaster's browser with different clocks
then still agree. Setup removes a leftover `launch` whenever it opens with
the world stopped.

## What changes

1. **Spike**: done, see "Spike results".
2. **The shared format** (`packages/shared`): the schema above, its limits,
   and the rules (who writes what, when a result counts as applied).
3. **Setup writes the queue and reads the report** (extension and app,
   shared UI): queuing, cancelling and Launch's review write the world's
   flags; the world page reads its modules from the report. The
   background keeps the library, and a cache of the last report per world
   for Setup's first paint.
4. **The companion on its own**: reads the queue and launch intent from
   `game.world.flags`, applies, writes the report with the world edit,
   reloads once if anything changed. It sends only its own world's id
   (see the risks). The bridge is removed: HELLO, SNAPSHOT_PUSH,
   COMMANDS_PULL and COMMAND_ACK, the game-page bridge and the relay's
   handlers. After its own save the companion keeps what it wrote: the
   running page's `game.world.flags` shows the save only after a reload.
5. **The app**: "apply now" stays as the out-of-sight join (phase 7), but
   its done comes from the report in the world's flags (read by the game
   page after the reload) instead of watching the relay.
6. **Tests**: unit tests on both sides; the harness on both targets; the
   device suite; and a new live test with no extension at all (Foundry's
   own join in a plain browser) that sees the companion apply and report.

## Decided (2026-11-09)

- **The bridge is removed**, not kept for a release: there has been no
  release, so no installed companion depends on it, and no local queue
  needs moving into the worlds.
- **Changes not reviewed on Setup** go through the companion's dialog
  wherever the Gamemaster joins, as today. "Reviewed" means Setup's Apply
  and launch: Setup records the modules on after the launch as shown on
  its review sheet; the companion applies without asking only when the
  live result equals that list and the plan has no conflicts, dependents,
  missing or blocked modules (`asReviewed` in `packages/module/src/apply.ts`).
- **Foundry 13** works the same way (spike), so 13 and 14 share one path.

## Spike results (2026-11-09)

Run on two private servers next to the shared one (13.351 on port 30013
with its own data folder; 14.370 on port 30014 with its own data folder),
each with a fresh dnd5e world; scripts kept out of the repository. The
results were the same on both versions unless noted:

- The Gamemaster's save from the game page (`fetch` POST `/setup`
  `{action: "editWorld", id, flags: {stagehand: ...}}`) answers 200 and
  writes `world.json` at once (6 to 110 ms).
- Saves merge: a second save with only `report` keeps `queue`; a key is
  removed with `"-=queue": null`. No other field of `world.json` changed.
- The running page's `game.world.flags` does not show the save until the
  page reloads; after a reload it does.
- The Assistant GM and a player are refused (403 on 13, 400 on 14), and
  `world.json` stays as it was.
- The flags last through the world's shutdown and the next launch, and
  Setup's `game.worlds` shows them (Setup loaded in about 0.45 s with a
  6 KB world file).
- A request body over 100 KB is refused with 413 (101 330 bytes accepted,
  103 378 refused).
- Foundry 13 differences that matter to tests only: worlds are created
  with `/setup` `createWorld` (14: `/create`), the package list answers
  `{packages, owned}` (14: an array), and the world shuts down with
  `{shutdown: true}` (14: `{action: "worldShutdown"}`).
- **A Foundry bug** (seen on 13; 14's code is the same): the save looks the
  world up by the id in the request, then makes that world the running
  one. A Gamemaster in world A can save world B's `world.json`; the server
  then reports B as active and A's game page no longer loads until the
  server restarts.

## Risks

- `editWorld` is Foundry's internal request name, not a public API; our
  Setup already depends on it behind the remote config's `editWorld` flag.
  The in-world use goes behind its own flag, so a Foundry release that
  changes it turns the feature off rather than breaking Setup.
- Any Gamemaster (and any module running as one) can write the world's
  flags: a module could queue or mark changes as reviewed. A module
  running as the Gamemaster can change the world's modules anyway, so this
  adds no power; Setup treats everything it reads as untrusted.
- Because of the Foundry bug above, a Gamemaster of **another** world on
  the same server can write this world's flags, which matters on servers
  where different people run different worlds. What limits it: only one
  world runs at a time, so such a write lands while this world is
  stopped; Setup lists everything in the queue on its review sheet before
  a launch, writes a fresh `launch` for it and removes a leftover one; and
  the companion honours `launch` only when it was written just before the
  world started (server time). A forged queue without a fresh `launch`
  reaches the companion's dialog, never a silent apply. The companion
  never sends another world's id. Worth reporting to Foundry.
- Two Gamemasters joining at once: the companion applies only for the
  first one in (as today, the companion runs for the full Gamemaster), and
  the world edit is one request per change of state.

## Size

About the size of phase 7: the shared format, the Setup side, the
companion, the app and the tests, less the bridge, which goes. Foundry 13
needs no separate path.
