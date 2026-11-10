# Library sync through the server

Status: plan, 2026-11-10. Replaces PRD D-3 (sync via the companion) and drops
D-4's notes switch.

## Goal

The library (folders, tags, notes, saved views, presets) and the "sorted" set
follow the admin to every device that opens the server's Setup: Chrome
extension, Firefox add-on and the Android app. Export and import stay, as a
backup, but nobody needs them to move between devices.

Stays per device: the server list (there is no server to keep it on), news
seen, and the caches of server state (Setup data, snapshots, commands; world
data already travels through the world's flags, see
COMPANION-WORLD-PROTOCOL.md).

## Owner's decisions (2026-11-10)

- The library lives on its own server, as a file in the Data folder.
- No encryption: the file is readable by URL like everything else in Data
  (module files, `world.json`), and module notes are not expected to hold
  anything private. No notes switch either.

## What Foundry allows (checked in code and on private 13.351 and 14.370)

Spike: `spikes/library-sync/upload-spike.ts`.

- `POST /upload` (multipart: `source=data`, `target`, `upload`) accepts an
  admin session on Setup with no world running (`views/upload.mjs`:
  `session.admin`). Both answered `success`.
- `.json` is a TEXT extension and TEXT is a media category, so an upload may
  overwrite an existing file (`files.mjs`: `overwrite = media && !manifest`).
  Overwrite checked on both versions; only `module.json`, `system.json`,
  `world.json` and `template.json` can never be overwritten.
- The target folder must exist. `FilePicker.createDirectory("data", path)`
  works on Setup for the admin (socket `manageFiles`); a second call fails
  with `EEXIST`, which we treat as success.
- The file is served at once with `Cache-Control: no-cache` and
  `application/json`, to anyone, logged in or not.
- No delete request exists; we never need one.
- Right after a server start, Setup's `game.socket` does not exist yet and
  `createDirectory` fails ("reading 'emit'"). Waiting for
  `game.socket.connected` fixes it: 0.7 s on 14, 7 ms on 13 (phase 1, both
  servers cold-started). The client waits for the socket before creating
  the folder.

## Design

### Where

`Data/stagehand/library.json`, one per server. Written by Setup (extension or
app) only while Foundry reports `isAdmin`; read by any of our Setup pages.

### File

```json
{ "format": "stagehand-library", "version": 1, "savedAt": "...",
  "library": { ...LibrarySchema... }, "sorted": ["module-id", ...] }
```

Read through Zod (`LibrarySchema` plus a small wrapper). The file is
untrusted: a world user with Foundry's upload permission can overwrite it
(json counts as media). An invalid file is ignored with a notice and never
replaces the local library; text is rendered as text, as today. A forged
preset still goes through the companion's review dialog before it changes a
world.

### When

- Pull: when an admin Setup opens and when the page becomes visible again.
- Push: shortly (about 2 s) after the last library change, and on leaving the
  page if a push is pending.
- Each device keeps the last server copy it saw (`base`) beside its library.

### Merge (keeps PRD D-2: never overwrite silently)

On pull, three-way merge of base, local and server, per item: folders, tags,
presets and views by id, module metadata by module id, `sorted` as a set
union.

- Changed on one side only: that side wins.
- Added on either side: kept. Deleted on one side and unchanged on the other:
  deleted.
- Changed on both sides: merged field by field. A field changed on one side
  takes that side's value; tag lists and preset modules merge as sets.
- The same field changed on both sides: this device's value wins; two notes
  or preset descriptions are both kept, joined (cut at the note limit).
- Edited on one side, deleted on the other: the edit wins.
- Each clash is reported, so the page can name the item in a notice.
- After the merge, references are repaired (`integrity.ts`): no module in a
  missing folder or with a missing tag, folders at most two levels deep and
  without loops, folder order renumbered.
- Revisions: an item unchanged on this device keeps its revision; a changed
  one gets one newer than both copies, so an open editor's stale save is
  still a conflict (D-2). Revision-only differences never count as changes,
  so two devices don't push back and forth.

Correction (phase 1): the plan first sent clashes to "the existing merge
prompt", but there is none: a stale save only reloads the library with a
notice (`ui/actions.ts`). A prompt would be a new screen needing a design, so
clashes resolve as above, without losing anything, and a prompt can come
later if clashes turn out to matter.

Which base (review, phase 3): every save of the file has a fresh `id` and
the ids of the saves it was merged from (`history`, the last 50). A device
merges three-way only when the server's file is, or descends from, the
save it last saw. Otherwise (the file was replaced or repaired, another tab
of the same browser read an older file, two devices saved at the same
moment) it merges as a union with no base: nothing is deleted, and in those
rare cases a deletion can come back.

After a push the client reads the file back; if another device wrote in
between, it merges again, at most three rounds, then looks again after the
usual delay. Known limit: Foundry's upload has no compare-and-swap, so a
device writing between our read and our write is overwritten; its own
items return on its next sync (union, as above), but its deletions in that
moment may be undone.

### First sync on a device

- Server has no file: upload the local library.
- Device has an empty library: take the server's.
- Both have content (the usual case right after this ships, with libraries
  moved by export/import): merge with an empty base, so everything is kept;
  same-id items that differ clash as above.

### Where it runs

The background owns the library (`background/state.ts`), but only the page
holds the admin session. So the page does the HTTP (`fetch /stagehand/...`,
`/upload`, `createDirectory`) through `page-*.ts`, and the background does
the merging and storage. Same split in the app (`app/background.ts`). The
merge lives in `packages/shared/src/library/merge.ts`, plain functions,
covered by unit tests.

### UI

The sync state in the Library's toolbar, beside Import and export: a quiet
cloud icon when synced, spinning arrows while syncing, and "Library not
synced" with a warning icon when it failed (Foundry refused the upload, the
file could not be read, a newer Stagehand wrote it). The full text is the
tooltip and the screen reader's label. Built as an icon rather than a line
of text to keep the toolbar calm; the phone layout does not show it yet. No
setting to turn sync off in v1.

## Phases

1. Merge core in shared (TDD): `merge.ts`, file wrapper schema, tests for
   every rule above, first-sync cases. Spike re-run on freshly started 13
   and 14 servers. Done 2026-11-10: `merge.ts`, `merge-fields.ts`,
   `integrity.ts`, `sync-file.ts`; tests `library-merge.test.ts`,
   `library-sync-file.test.ts`.
2. Page side: read, ensure folder, upload, read-back; extension and app.
   Unit tests with a fake Foundry; live test on a private 14 server. Done
   2026-11-10: LIBRARY_FILE / LIBRARY_FILE_DONE (`page-library-file.ts`),
   `page/library-file.ts` (upload first; on "does not exist", wait for the
   socket, create the folder, upload again), `PageBridge.libraryFile`; live
   `tests/foundry/setup-library-sync.spec.ts` passes on 14.370. On 13.351
   our Setup page does not open (remote config has 14 adapters only), so
   the spec cannot run there.
3. Background: base copy, pull and push scheduling, clash notices; status
   line. Done 2026-11-10: `background/library-sync.ts` (merge inside the
   library's serialised update; the base moves only after a confirmed
   write), messages `library-sync` / `library-synced` (admin-gated),
   `ui/library-sync.ts` (one sync at a time, 2 s batching, read-back, at
   most 3 rounds), `ui/library-sync-start.ts` (starts on an admin-verified
   Setup, again when the page shows, flushes when it hides; Foundry notices
   for clashes and a replaced file). The status is a quiet icon in the
   Library toolbar (cloud, spinning arrows while syncing), with words only
   when sync failed; the reason is in its tooltip. Live: four tests in
   `setup-library-sync.spec.ts` pass on 14.370.
4. Live suites: two browser contexts on one server edit offline, both sync,
   no change lost; app plus extension on the same server; invalid file is
   ignored. On 14 (13 once our Setup page runs there). Done 2026-11-10:
   `tests/foundry/setup-library-devices.spec.ts`, two Chrome profiles with
   their own extension copies (`loadExtension` option `copy`): a tag made on
   each ends up on both, a deletion on one reaches the other, a damaged file
   is replaced with a notice. Passes on 14.370. The app is not one of the
   devices: its harness cannot open Setup at the moment (`app-smoke` fails
   the same way, a problem from before this work). The intake test in
   `setup-library.spec.ts` now also unsorts the module in the server's file,
   since sorted modules sync.
5. Docs: PRD D-3 and D-4 updated, README, privacy note (the library is stored
   on the admin's own server, readable by URL).

## Not in v1

- Large libraries over the app's bridge: the file text crosses the
  page-to-background messages both ways (up to 8 MB allowed). Real
  libraries are tens of KB; the WebView bridge's practical limit is not
  measured yet.
- Foundry 13: sync runs where our Setup page runs, and that is 14 only for
  now. Foundry 13 itself allows everything sync needs (spike).
- Syncing the server list between devices.
- Hosts without a writable Data folder (The Forge): sync shows as
  unavailable there.
- World GMs reading published presets (PR-5) from the file: possible later,
  since the file is already readable by URL.
