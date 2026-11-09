# The companion through the world (plan)

Status: proposed 2026-11-09, for the owner's decision. Not started.

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

Sizes stay small: module ids at most 200 characters, `active` at most 5000
entries, results only for the last launch.

## What changes

1. **Spike: confirm Foundry does it** (first, before any build).
   - From the game page, as the Gamemaster, `fetch` POST `/setup`
     `{action: "editWorld", id, flags: {stagehand: …}}`: saved to
     `world.json`, kept through the world's reload and shutdown, and seen
     by Setup afterwards.
   - The same on Foundry 13 (the PRD targets 13 and 14). If 13 refuses it,
     13 keeps today's bridge.
   - An Assistant GM is refused (Foundry checks the Gamemaster role); a
     player is refused.
   - How big `flags` may get before Setup slows down.
2. **The shared format** (`packages/shared`): the schema above, its limits,
   and the rules (who writes what, when a result counts as applied).
3. **Setup writes the queue and reads the report** (extension and app,
   shared UI): queuing, cancelling and Launch's review write the world's
   flags; the world page reads its modules from the report. The
   background keeps the library, and a cache of the last report per world
   for Setup's first paint.
4. **The companion on its own**: reads the queue and launch intent from
   `game.world.flags`, applies, writes the report with the world edit,
   reloads once if anything changed. The bridge becomes optional: the
   companion no longer waits for HELLO to act.
5. **The app**: "apply now" stays as the out-of-sight join (phase 7), but
   its done comes from the report in the world's flags (read by the game
   page after the reload) instead of watching the relay.
6. **Moving the queue over**: on the first Setup load with the new version,
   each world's pending changes move from local storage into its flags,
   once; a world whose flags already hold a queue keeps it and the local
   copy is shown for the user to merge or drop.
7. **Tests**: unit tests on both sides; the harness on both targets; the
   device suite; and a new live test with no extension at all (Foundry's
   own join in a plain browser) that sees the companion apply and report.

## Decisions for the owner

- **The bridge**: keep it as a second path for a release, or remove it
  once the world path works (recommended: keep one release, then remove).
- **Changes not reviewed on Setup**: the companion asks the Gamemaster in
  its dialog wherever they join, as today (recommended), or applies only
  reviewed launches.
- **Foundry 13**: if the in-world edit isn't there, 13 keeps the bridge,
  or 13 support ends with this change.

## Risks

- `editWorld` is Foundry's internal request name, not a public API; our
  Setup already depends on it behind the remote config's `editWorld` flag.
  The in-world use goes behind its own flag, so a Foundry release that
  changes it turns the feature off rather than breaking Setup.
- Any Gamemaster (and any module running as one) can write the world's
  flags: a module could queue or mark changes as reviewed. A module
  running as the Gamemaster can change the world's modules anyway, so this
  adds no power; Setup treats everything it reads as untrusted.
- Two Gamemasters joining at once: the companion applies only for the
  first one in (as today, the companion runs for the full Gamemaster), and
  the world edit is one request per change of state.

## Size

The spike first; then about the size of phase 7: the shared format, the
Setup side, the companion, the app, the move-over and the tests. The spike
decides whether Foundry 13 needs a separate path.
