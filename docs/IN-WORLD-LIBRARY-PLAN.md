# The library inside a world (plan)

Status: planned 2026-11-18 (GitHub issue #2). Not built. Next step: a
clickable mockup for the owner, then the spike.

## Goal

A Gamemaster in a running world sees the server's library (folders, tags,
notes) in Foundry's own Manage Modules window, and applies the library's
presets to the world, without opening Setup.

Who it is for:

- **Guest Gamemasters on a shared server.** They don't have the admin
  password, so Setup (and with it the extension and the app) is closed to
  them. The world is the only place Stagehand reaches them.
- **Anyone already in a world**, admin included: the folders and tags they
  made on Setup, where they manage modules in the game. The owner would use
  it in place of BBMM's module presets.

## Owner's decisions (2026-11-18)

- **Read-only in v1.** Nothing in a world writes the library. Folders, tags
  and notes show in Manage Modules; organising stays on Setup. This is what
  PRD 7.11 already says for world Gamemasters.
- **Apply presets is in v1, with our own dialogs:** choose presets and a
  mode (Add, Replace, Remove), then the companion's diff and confirmation
  (`packages/module/src/dialog.ts`). Not Foundry's checkboxes.
- **No "save as preset" in a world**, and no new Setup action for it:
  Setup's presets from a folder, a group or a selection are enough.
- **The Forge is not covered.** It has no Setup (so no extension or app),
  keeps files in per-user asset storage, and installs modules through its
  Bazaar. The companion stays quiet there.
- **Settings presets and settings sync** stay out of scope (PRD).
- **Later, only on request:** separate libraries for guest Gamemasters, and
  editing from a world (see "Later").

## Two kinds of server

The owner's framing:

- **One Gamemaster, many worlds.** The server is theirs; they don't care
  where they organise from.
- **A shared server:** an admin and guest Gamemasters, whose organisation
  can differ from the admin's, under whatever rules the admin keeps.

v1 serves both without a setting: everyone sees the admin's library, and
nobody changes it from a world.

## Considered and set aside

An architect, a designer and a product manager were consulted
(2026-11-18). Set aside, and why:

- **Detecting whether the admin uses the extension**, to decide who may
  edit from worlds: the signal goes stale (installed once, phone only),
  and it would change a guest's window for a reason they can't see.
- **Access levels per world** (edit, view only) on the one shared library:
  permissions fit neither kind of server. The solo Gamemaster gets settings
  they never need; guests want their own organisation more than edit rights
  to the admin's.
- **Proposals reviewed on Setup:** Setup and a world are never open at the
  same time, so a proposal waits until the admin's next visit, and it needs
  review screens in the extension and the app. Hosted users have no Setup
  to review in.
- **Local overrides as a patch over the shared library:** once the admin
  renames, moves or deletes what a world patched, "whose folder is this?"
  has no clear answer.

## What Foundry allows (checked in 14.370 code)

- `Data/stagehand/library.json` is served to anyone, with
  `Cache-Control: no-cache` (LIBRARY-SYNC-PLAN.md), so a world reads it
  with a plain `fetch` through `foundry.utils.getRoute`.
- Setup can't be open while a world runs: `/setup` redirects to `/game` or
  `/join` while a world is active (`dist/server/views/setup.mjs`). The file
  doesn't change under an open world.
- Manage Modules is `ModuleManagement`, an ApplicationV2 form
  (`client/applications/sidebar/apps/module-management.mjs`), template
  `templates/sidebar/apps/module-management.hbs`: a search box, filters
  (All, Active, Inactive), an expand toggle and a `menu.package-list` of
  `li.package[data-module-id]` rows with a tag strip
  (`templates/setup/parts/package-tags.hbs`). 13.351's template differs
  only in two localisation keys.
- Writing files is not needed in v1.

## Design

### Reading the library

When Manage Modules renders, the companion fetches the file (no-store) and
reads it with the shared `parseSyncFile` (size cap, Zod, references
repaired). The file is untrusted, as everywhere: text is rendered as text.
A missing or invalid file leaves the window exactly as Foundry draws it;
an invalid one is logged once.

Shown to full Gamemasters and Assistant GMs. Players see Foundry's window
unchanged.

### In Manage Modules

- **Folder groups:** headers styled like Foundry's sidebar folders (folder
  colour, caret, "12 · 5 active"), two levels as in the library, "Not in a
  folder" last. Collapse state is kept per user (client setting).
- **Foundry's own rows are moved, never rebuilt,** so what other modules
  (BBMM, Module Management+) add to a row survives. A header hides when
  the search or a filter hides all of its rows.
- **Tags** in the row's tag strip, as Foundry `.tag` spans with the tag's
  colour and name (never colour alone).
- **Notes** as an icon with `data-tooltip-text`; in Foundry's expanded
  mode, also the first line of the description.
- **Search** matches tag names and notes too.
- **Folders or A–Z:** a small toggle beside Foundry's expand button
  returns to Foundry's flat order, also the way out when another module
  reorders the list.

### Apply presets

- An "Apply presets…" button in the window's footer, for full Gamemasters
  only (PR-4).
- Our dialog: the library's presets to choose from, and a mode (Add,
  Replace, Remove). Then the existing diff and confirmation, the plan from
  the shared resolver against the live world (`world-state.ts planFor`),
  and the same save and reload as a queued change (`apply.ts`).
- Ticks in Manage Modules that were not saved are dropped when a preset is
  applied; the dialog says so.
- The companion keeps itself enabled, as in every mode (C-5).

### The Forge

The companion detects the Forge and does nothing there (the global's name
is checked in the spike).

## Phases

0. **Mockup:** one clickable artifact with Foundry's CSS: Manage Modules
   grouped by folders, in A–Z order, and with no library; the Apply presets
   dialog through to the diff. The owner chooses; the mockup is then the
   spec. Built 2026-11-18 in `design/in-world-library` (published at
   https://claude.ai/artifact/SjcMMvJ6B7MmQWuWpZ8mTj), waiting for the
   owner's review. Choices in it to confirm or change: Apply Presets is the
   footer's last button; a line under the list says where folders, tags and
   notes come from; folder headers count "N of M active"; a search opens
   folded folders that hold matches; the folders/A–Z choice and folded
   folders are kept per user; Assistant GMs see the library without Apply
   Presets; players see Foundry's window unchanged; the diff dialog offers
   Apply & Reload, Back and Cancel.
1. **Spike:** grouping rows in Manage Modules on 13.351 and 14.370, alone
   and with BBMM and Module Management+ installed; search, filters and the
   expand toggle after regrouping; re-renders. The Forge's global.
2. **Build (tests first):** the library read in the module, grouping, tags,
   notes, search, the toggle; the Apply presets dialog over the existing
   plan and dialog. Unit tests with fakes; live specs on the private 13 and
   14 servers.
3. **Docs:** COMPANION-GUIDE.md, the module's README and manifest
   description, CHANGELOG. The foundryvtt.com listing text is the owner's
   to write (Foundry's AI policy).

## Later, only on request

- **Separate libraries for guest Gamemasters.** A world can use a library
  of its own (a file beside the server's, named in the world's flags), so a
  guest's organisation is fully theirs; the server library's presets stay
  visible to them, read-only.
- **Editing from a world** (one-Gamemaster servers). Notes from the
  architect for then: write each change as a library operation (`ops.ts`)
  on a fresh read of the file, upload, read back; raise `MAX_HISTORY` (50)
  and batch saves, or a long session pushes Setup's last-seen save out of
  the history and deletions come back; keep backups before deletions; keep
  any access rules in a separate file only Setup writes, since today's
  `parseSyncFile` drops unknown fields and a format version bump would stop
  sync on apps that haven't updated.
- **Import from BBMM and Module Profiles** (issue #2, step 3).
