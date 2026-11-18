# The library inside a world (plan)

Status: planned 2026-11-18 (GitHub issue #2). Not built. Next step: the
owner's review of the mockup (Setup's cards in Module Management), then the
spike.

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
  and notes show in Module Management; organising stays on Setup. This is what
  PRD 7.11 already says for world Gamemasters.
- **Presets are in v1, with our own dialogs:** choose presets and a mode
  (Add, Replace, Remove); their changes are marked on the cards, and saving
  reviews them in the companion's diff (`packages/module/src/dialog.ts`).
  Not Foundry's checkboxes.
- **Setup's world page inside Module Management** (owner, 2026-11-18,
  after the first mockup): the Modules tab of Setup's world page (cards,
  folder sections, the module panel), reused rather than a second design,
  and a setting to turn it off. This replaced the first design
  (Foundry's rows moved into folder groups, tags in the rows, a details
  pane of our own).
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

### In Manage Modules: Setup's world page

What Setup's world page does for a world from outside, Module Management
does from inside, so the window shows that page's Modules tab (owner,
2026-11-18):

- **Cards in folder sections:** one card per module with its switch, the
  title and one line (what needs it, "Needs X, which is off", from which
  preset, not verified, the note, or the description), as on Setup.
  Sections are the library's folders (one level, as Setup makes them;
  "Unfiled" last) with "N of M on"; folded sections are kept per user.
- **Group by** Folder, Tag, Author or Smart group, Setup's four modes
  (`model/library-groups.ts`), inline in the tools row as on Setup's
  Library (Setup's world page keeps it under View options); kept per user.
  Smart groups are the ones a world can work out from its own manifests:
  Libraries, Content packs, System, Not verified. "Unused in known worlds"
  needs the other worlds, so it isn't offered.
- **All, On, Changes** and a search that also matches tags and notes.
- **Changes are marked, then saved:** a flipped switch marks its card
  "turns on" or "turns off"; a line counts the changes and problems with
  Review and Discard; Foundry's Save Module Settings shows the count and
  opens the review (Turns on, Added as dependencies, Turns off, Still
  needed by modules that stay), then saves and reloads.
- **The module panel**, as on Setup, opened by clicking a card and closed
  with x. The window keeps one width (owner, 2026-11-18: a window that grows
  and shrinks is worse, and some screens lack the room); the cards always
  keep three columns, narrower while the panel is open, so opening or
  closing it moves no card to another row or column. The panel: Library tab (folder, tags, note, presets, this world's switch;
  read-only, with a line saying it is organised on the Setup screen) and
  Package tab (version and verification, authors, relationships, contents).
  Setup's "On in worlds" becomes this world only: a world can't see the
  others.
- **A setting instead of a switch** (owner, 2026-11-18): no layout switch
  in the window. Stagehand's tab in Configure Settings has "Library view
  in Module Management" (short enough for one line in Foundry's label
  column), on by default, per user
  (Foundry's user scope). Hint: "Modules appear as cards in the library's
  folders, with each module's details, presets and a review before saving.
  Turn this off for Foundry's own list, for example if another module adds
  to that window. This applies to you only." Off is Foundry's own window,
  untouched (its Expand included), the way out when BBMM or Module
  Management+ add to Foundry's rows.
- **Without a library**, and **for players**, Foundry's window stays as it
  is.

### Presets

- "Apply preset…" in the tools row (owner's wording), for full Gamemasters
  only (PR-4); Setup's
  "Copy from another world" has no place here.
- Our dialog: the library's presets and a mode (Add, Replace, Remove).
  "Mark Changes" marks them on the cards ("From the preset X"); a module the
  preset names but the server doesn't have is named in a notice.
- Saving goes through the same review, with the presets listed; the
  companion keeps itself on (C-5).

### Reuse, not a copy

The cards, sections, module panel and their CSS move from
`packages/extension/src/ui` into a shared UI package used by Setup and the
companion. The companion gives them a provider for a world: modules from
`game.modules`, the library from its file, this world only; switching and
saving through Foundry's module configuration. The read-only mode exists
already (`canChange`, PR-2 and V-3). The companion loads this code only when
a Gamemaster opens the window, so players never download it. Setup's CSS is
limited to its own markup so it can't reach the game's interface.

### The Forge

The companion detects the Forge and does nothing there (the global's name
is checked in the spike).

## Phases

0. **Mockup:** `design/in-world-library`, published at
   https://claude.ai/artifact/SjcMMvJ6B7MmQWuWpZ8mTj. First version
   2026-11-18 (Foundry's rows in folder groups, then a details pane); the
   owner chose to reuse Setup's cards instead, and the mockup now shows
   them, built from the Setup mockup's own CSS. Waiting for the owner's
   review. Choices in it to confirm or change: presets marked on the cards
   and applied by saving (not at once); the review before saving; Assistant
   GMs get the cards without Apply preset; folded sections and Group by kept
   per user; Stagehand's own card is always on, as on Setup; the setting's
   per-user scope; "Mark Changes" as the preset dialog's button (its changes
   wait for Save).
1. **Spike:** Setup's Modules tab rendered inside Module Management on
   13.351 and 14.370 (window size, Foundry's re-renders, light and dark
   interface), alone and with BBMM and Module Management+ installed; loading
   the shared UI on demand from the companion. The Forge's global.
2. **Build (tests first):** the shared UI package out of
   `packages/extension/src/ui` (Setup's live suites must still pass); the
   companion's provider (library file, `game.modules`, saving and reload);
   Add a preset and the review over the existing plan and dialog. Unit tests
   with fakes; live specs on the private 13 and 14 servers.
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
