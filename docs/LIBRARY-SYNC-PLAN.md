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
- Open: the first run right after a server start did not create the folder
  (later runs did, from a clean state). Likely the Setup socket was not yet
  connected. The client waits for the socket and retries once; phase 1
  checks this on a freshly started server.

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
- Changed on both sides: the item goes to the existing merge prompt
  (`entities.ts` conflict); until answered the local copy stays and nothing
  is pushed for that item.

After a push the client reads the file back; if another device wrote in
between, it merges again (a small window remains: Foundry has no
compare-and-swap; acceptable for one admin on a few devices).

### First sync on a device

- Server has no file: upload the local library.
- Device has an empty library: take the server's.
- Both have content (the usual case right after this ships, with libraries
  moved by export/import): merge with an empty base, so everything is kept;
  same-id items that differ go to the merge prompt.

### Where it runs

The background owns the library (`background/state.ts`), but only the page
holds the admin session. So the page does the HTTP (`fetch /stagehand/...`,
`/upload`, `createDirectory`) through `page-*.ts`, and the background does
the merging and storage. Same split in the app (`app/background.ts`). The
merge lives in `packages/shared/src/library/merge.ts`, plain functions,
covered by unit tests.

### UI

A small status line on the Library page: "Synced with this server",
"Syncing...", "Not synced: <reason>" (no admin session, Foundry refused the
upload, The Forge or another host without a Data folder). No setting to turn
it off in v1.

## Phases

1. Merge core in shared (TDD): `merge.ts`, file wrapper schema, tests for
   every rule above, first-sync cases. Spike re-run on freshly started 13
   and 14 servers.
2. Page side: read, ensure folder, upload, read-back; extension and app.
   Unit tests with a fake Foundry; live test on a private 14 server.
3. Background: base copy, pull and push scheduling, conflict hand-off to the
   merge prompt; status line.
4. Live suites: two browser contexts on one server edit offline, both sync,
   no change lost; app plus extension on the same server; invalid file is
   ignored. 13 and 14.
5. Docs: PRD D-3 and D-4 updated, README, privacy note (the library is stored
   on the admin's own server, readable by URL).

## Not in v1

- Syncing the server list between devices.
- Hosts without a writable Data folder (The Forge): sync shows as
  unavailable there.
- World GMs reading published presets (PR-5) from the file: possible later,
  since the file is already readable by URL.
