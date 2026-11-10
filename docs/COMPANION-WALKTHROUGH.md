# The companion module, walked through

For the author before submitting to Foundry's package listing, and for
anyone reviewing the module. Foundry's AI policy asks the author to
"understand, explain, modify, and maintain every part" of the submitted
code; this is the map of that code. Read it next to the source.

## What it is for

Stagehand's Setup page (extension or app) can't see inside a world: which
modules are on, and Foundry keeps that in the world's own database, out of
Setup's reach. The companion runs inside the world, reports the active
modules, and applies the module changes queued on Setup. Everything goes
through the world's own `world.json`, in `flags.stagehand`, which Setup can
read and write too. No other channel exists between them.

## What ships

`packages/module/dist`, zipped by the release workflow:

- `module.json`: the manifest (`packages/module/static/module.json`).
- `stagehand.js`: `packages/module/src/*.ts` bundled with the parts of
  `packages/shared` it imports, not minified.
- `lang/en.json`: the dialog's and notices' strings.

## One join, step by step

1. `index.ts`: on Foundry's `ready` hook, `start()` checks
   `isFirstGamemaster` and does nothing for anyone else. Then it runs one
   world session with real dependencies (`fetch`, Foundry's route helper,
   `DialogV2`, notifications, reload). Errors are logged, never thrown
   into Foundry.
2. `gamemaster.ts`: only the full Gamemaster (role 4) with the lowest user
   id among those online runs it, so two GMs never apply twice. Assistant
   GMs never do: Foundry's world edit refuses them anyway.
3. `world-session.ts`, `runWorldSession`:
   - reads `flags.stagehand` through `readStagehand` (shared
     `world-flags.ts`): validated, versioned. Data from a newer Stagehand:
     a notice, and stop. Unreadable data: a notice, and treat it as empty.
   - asks the server's clock (`world-io.ts`, `clock`) to tell whether the
     launch intent Setup wrote belongs to this launch (`launchIsFresh`).
     An intent is used once; a later restart doesn't reuse it.
   - no queue, or Setup said "hold": `reportOnly` writes the report (active
     modules with versions, Foundry and system versions, results), only if
     it changed.
   - a queue: `applyQueue` hands it to `apply.ts` with a `record` function
     that saves results and removes recorded entries from the queue.
4. `apply.ts`, `applyCommands`:
   - plans against the live world (`world-state.ts`, `planFor`, using the
     shared resolver): what turns on and off, what other modules need,
     conflicts, missing or blocked modules.
   - a launch Setup reviewed, whose live plan matches what was reviewed
     exactly and raises no question: applies without asking, with a notice.
   - otherwise `dialog.ts`, `askGm`: Apply & reload, Not now, or Discard.
     Conflicts need the box ticked; removing what others need needs a
     choice.
   - records "applying" with a key of the target set before changing
     anything. If the record can't be saved, nothing changes (else the
     same change would apply again next time).
   - writes core's `moduleConfiguration` setting (`world-state.ts`,
     `moduleConfiguration`: every installed module listed, the companion
     always on, entries for modules not installed right now kept), then
     reloads once.
5. Next join, after the reload: `settle` turns "applying" into "applied"
   when the active modules match the recorded key, or "failed" with a
   reason when they don't.

## The files

| File               | Lines | Role                                                                                  |
| ------------------ | ----- | ------------------------------------------------------------------------------------- |
| `index.ts`         | 40    | Entry point, wiring, first-GM check                                                   |
| `foundry.ts`       | 87    | The few Foundry APIs used, typed narrowly; the one place that reads Foundry's globals |
| `gamemaster.ts`    | 17    | Which Gamemaster runs the session                                                     |
| `world-session.ts` | 166   | One join: read flags, settle, report or apply, save                                   |
| `apply.ts`         | 142   | Plan, ask, record, write, reload                                                      |
| `dialog.ts`        | 146   | The confirmation dialog; escapes every value it shows                                 |
| `world-state.ts`   | 60    | Reads the live world; builds the plan and the module configuration                    |
| `world-io.ts`      | 116   | Saves our flags (Foundry's `editWorld`) and reads the server clock (`/api/status`)    |

From `packages/shared`: `world-flags.ts` (the flags' format, validation,
size limits), `resolver.ts` and `resolver/` (the plan), `package-read.ts`
(a module's manifest as plain data), `version.ts` (Foundry version parsing),
`log.ts`, `zod-config.ts`.

## What it touches

- Writes: `flags.stagehand` of the running world (through `POST /setup`
  `editWorld`, which Foundry allows a full Gamemaster while the world runs),
  and core's `moduleConfiguration` setting when a change is applied.
- Reads: the world's modules, users, versions and settings; `/api/status`
  for the server's clock.
- Network: only the Foundry server it runs on. No other host, no telemetry.
- Players and Assistant GMs: nothing runs.

## Safety rules worth being able to explain

- Record before change (`apply.ts`, `write`): an unrecorded change would be
  applied again on the next join.
- The live world wins (`planFor`): the plan is made from what is installed
  and on now, never from Setup's possibly stale snapshot.
- Everything read from the flags is untrusted (`readStagehand`): Setup, a
  Gamemaster in another world, another tool or a hand edit of `world.json`
  could have written it.
- Every shown value is escaped (`dialog.ts`, `escapeHtml`).
- Saves are size-checked (`MAX_SAVE_BYTES`, `fitReport`): Foundry refuses a
  body over 100 KB.
- The companion is always kept on (`moduleConfiguration`, `MODULE_ID`), so a
  change can't switch off the thing that reports it.

## Questions a reviewer might ask

- Why `editWorld` instead of a world setting? Setup can't read world
  settings (they live in the world's database); `world.json` it can.
- Why only one Gamemaster? Two applying the same queue would race; the
  lowest id among those online is stable and needs no coordination.
- What if the GM closes the dialog? It counts as Not now: the queue stays.
- What if Foundry refuses the save? Nothing changes, and the GM sees why.

## Self-check before submitting

Without looking: say what happens on a join with an empty queue; with a
reviewed launch; when the record can't be saved; after the reload. Change
one string in `lang/en.json` and one rule in `refusal` (`apply.ts`), run
`pnpm test`, and undo it. If any of these is unclear, read that file again
before attesting.
