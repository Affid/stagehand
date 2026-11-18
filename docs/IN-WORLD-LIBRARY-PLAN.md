# The library inside a world (plan)

Status: planned 2026-11-18 (GitHub issue #2). Not built. The owner approved
the mockup the same day ("Looks good"); it is the spec. The spike passed
on 13 and 14 the same day (`spikes/in-world-library`). Next step: the build.

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
- **Active presets** (owner, 2026-11-18): a preset is active when every
  module in it that the server has is on (modules it lacks are left out of
  the count; the switches as they stand, unsaved changes included). The
  dialog marks it "Active" ("All 5 on here"); the module panel marks its
  chip with a check. Setup doesn't show this yet; its world page and
  Library could use the same rule.
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

### Other module managers in the same world

Read in their source (2026-11-18):

- **BBMM** (thejoester/bbmm 1.4.11, Foundry 13 and 14, active). Its world
  setting "Enable enhanced module management" (on by default, GM only,
  needs a reload) catches clicks on the sidebar's Manage Modules button in
  the capture phase and opens BBMM's own window; Shift-click still opens
  Foundry's (`scripts/module-management.js`, `renderSettings`). In
  Foundry's window it only adds a "BBMM" button to the header, which opens
  its toolbox (`settings.js`, `renderModuleManagement`); it doesn't touch
  the rows. Its module presets also write Foundry's module configuration,
  as ours do: two preset systems, no clash.
- So with BBMM's enhanced management on, Manage Modules opens BBMM and
  Stagehand's view shows only on Shift-click. With it off, Foundry's window
  opens with Stagehand's cards, and BBMM's header button still works,
  since Stagehand leaves the header alone.
- **Module Management+** (mouse0270/module-credits 2.2.0, verified for 11,
  last change January 2024) was written for the old window: it looks for
  `#module-list`, overrides `ModuleManagement.prototype._onChangeCheckbox`
  and reads `ModuleManagement.CONFIG_SETTING`, none of which exist in 13
  or 14. It fails there with or without Stagehand (BBMM's description says
  it broke in 13); nothing to design for.
- **Decided (owner, 2026-11-18): ask once, don't compete for the button.**
  When BBMM's enhanced management is on, Stagehand's Library view is on for
  that Gamemaster and nobody has answered yet in this world, the first full
  Gamemaster who loads the world gets "Stagehand: Two Module Views": "BBMM
  and Stagehand each have their own Module Management view. Which one
  should Module Management open in this world?" "Use Stagehand's view"
  turns off BBMM's setting through Foundry's settings (world-wide, so the
  dialog says so; BBMM requires a reload). "Keep BBMM's view" changes
  nothing and says to Shift-click Module Management (BBMM's own tooltip
  already reads "Shift-click for core"). Neither button is the default.
  The answer is kept for the world; closing the dialog asks again next
  time. Our setting's hint mentions Shift-click while BBMM holds the
  button. The sidebar button is labelled "Module Management" in 14.

### Keeping Foundry's save safe

Module Management is a form whose save takes the form's named checkboxes
as the whole module list; our view has none, so a save that slipped
through would switch every module off. The spike's guard (a capture-phase
`submit` listener) covers Enter and submit buttons but not code that calls
the window's `submit()`. So the build stacks these (2026-11-18):

1. **Fail-safe form content:** a hidden, complete set of the module
   checkboxes, named by module id and kept equal to the cards' switches. If
   Foundry's save ever runs, it saves what the cards show (with Foundry's
   own dependency check), never an empty list.
2. **The submit guard** from the spike, which opens our review instead.
3. **This window's save handler swapped for ours**, so code calling
   `submit()` reaches the review too. Foundry freezes a window's options
   only one level deep, and the submit listener uses the nested `form`
   object; the build's tests confirm it.
4. **Take over only a window that looks as expected** (Foundry 13 or 14,
   the class, `.window-content`); otherwise leave Foundry's window as it
   is, as Setup's safe mode does.
5. **Live tests on the dangerous paths:** Enter, the submit button,
   `submit()` from code, re-renders by Foundry and by another module. The
   world's module list must never come out empty.

BBMM's own window avoids all of this, but needs the sidebar button (which
we decided not to compete for) and leaves two module lists in the game.

### The Forge

The companion detects the Forge and does nothing there (the global's name
is checked in the spike).

## Phases

0. **Mockup:** `design/in-world-library`, published at
   https://claude.ai/artifact/SjcMMvJ6B7MmQWuWpZ8mTj. First version
   2026-11-18 (Foundry's rows in folder groups, then a details pane); the
   owner chose to reuse Setup's cards instead, and the mockup now shows
   them, built from the Setup mockup's own CSS. Approved by the owner
   2026-11-18, with the choices below; it is the spec. Choices in it to confirm or change: presets marked on the cards
   and applied by saving (not at once); the review before saving; Assistant
   GMs get the cards without Apply preset; folded sections and Group by kept
   per user; Stagehand's own card is always on, as on Setup; the setting's
   per-user scope; "Mark Changes" as the preset dialog's button (its changes
   wait for Save).
1. **Spike:** done 2026-11-18, `spikes/in-world-library` (README there):
   17 of 17 checks on 13.351 and 14.370. Our view replaces Module
   Management's content on every render and keeps its width; Preact and our
   CSS load on demand from the module (about 0.1 s); the light interface
   works; a player gets Foundry's list. Foundry's form save would read our
   view as an empty module list and switch every module off: a
   capture-phase `submit` listener stops it, checked with Foundry's settings
   write spied on. With BBMM (1.5.2): a click opens BBMM's window,
   Shift-click opens Foundry's with our view, BBMM's header button stays.
   For the build: a minimum height (owner, 2026-11-18: not a fixed one),
   so a short list doesn't make a small window and a long one still grows
   up to the screen.
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
