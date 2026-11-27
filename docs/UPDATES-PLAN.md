# Package updates: check, review, update (plan)

Status: planned 2026-11-26; the owner approved the mockup on 2026-11-27
("Ok, looks good to me") after four rounds of notes, recorded below. The
mockup (`design/setup-page`, Library > Updates, `updates.html`; playground
https://claude.ai/artifact/Uwa28i89Ds7U91x7oKZKBu, version 5) is the spec.
Not built yet.

## Goal

Updating modules and systems on Setup becomes three steps the owner can
see: Stagehand checks what is available (installs nothing), shows the list
with anything that could break, and updates only what the owner picks,
with progress all the way.

## What the owner asked for (2026-11-26)

- Warn about updates that break something: a module that no longer fits
  the installed system version, dependencies.
- See the available updates first, then choose and confirm.
- For one package: check without installing ("Update if available"
  installs at once).
- Check the whole library again on demand.
- A view of the modules that have updates.
- Notice when an update exists but can't be downloaded any more (for
  example a Patreon membership that ended).
- A progress bar for Update and Update All: today it is unclear whether an
  update is running or something broke.

## How updates work today (Stagehand 0.3.3, Foundry 14.370)

- **The marks** (the arrow chip on a card, "6 updates" on the rail) come
  from Foundry's public package list (`game.getPackages`, the
  foundryvtt.com index), read once per Setup load
  (`packages/extension/src/page/updates.ts`). A module that isn't listed on
  foundryvtt.com (most Patreon and private manifests) never gets a mark,
  though Foundry's Update All does update it. The marks also count
  availability 5 and 6, which Foundry's updater treats as current.
- **Update All and a card's update** press Foundry's own hidden controls
  (`page/actions.ts`, `page/package-actions.ts`), so Foundry's updater
  runs: it checks each package's manifest and installs at once.
- **Progress:** Foundry draws its install progress inside its hidden
  layout. Stagehand already receives it (`installPackage` ticks,
  `page-progress.ts`, kept in `state.tasks`), but nothing in the Library
  draws it. Only backups, snapshots and Foundry's own update do.
- **Checks Foundry makes before installing:**
  - Needs another Foundry version: refused, with an info toast.
  - A module's new version declares system versions that don't include the
    installed one: a single update asks first; Update All installs
    everything else and asks about the skipped ones at the end.
- **Checks nobody makes:**
  - Module dependencies. Foundry 14's `testAvailability` doesn't look at
    `relationships.requires` (a FIXME in its source says so): a new version
    that needs a newer library comes back verified (availability 1), and
    Foundry's updater installs it without a word, leaving the module ahead
    of its library. (Corrected 2026-11-27 from the live fixtures: the first
    version of this plan said such an update is skipped as current.)
  - A system update's effect on installed modules: updating dnd5e never
    asks which modules declare an older dnd5e range.
  - Anything a manifest doesn't declare. Few modules declare version
    ranges, so no warning means nothing was declared, not that it is safe.

## Design

### One flow: check, review, update

1. **Check** asks Foundry's own `checkPackage` for every unlocked package
   with a manifest, five at a time (Foundry's updater runs five). Foundry's
   server fetches each manifest, so private and Patreon manifests work.
   Nothing installs. Each package gets one result: up to date, an update
   (from, to, the manifest to install it from), blocked (and why), no
   access, or an error.
2. **Review** happens on the Updates tab, with warnings shown before
   anything installs.
3. **Update** installs only the ticked packages through Foundry's own
   `installPackage`, with the manifest from the check, after an optional
   backup. Foundry's progress shows on every place the package appears.

### The Updates tab

A fourth Library tab: Modules · Systems · By world · **Updates N**. N
counts the updates you can act on (Ready and Needs attention); the rail's
"N updates" uses the same number.

- **Head:** "Checked 4 minutes ago · 90 packages" and **Check again**.
  While checking: a bar, "Checking 34 of 90 · libWrapper", and Stop.
  Opening the tab checks again when the last check is over an hour old.
- **Sections** (the Library's section headers, folding):
  - **Ready** (ticked): title, module or system, from → to, Changelog,
    Foundry's verified badge, worlds that use it, and notes that don't
    block ("not verified for 14.369, verified for 13").
  - **Needs attention** (not ticked): the same row with the warning and
    its fix, for example "Needs Modular A/V 0.12.0 or newer (you have
    0.11.0) · Tick it too".
  - **Can't update here:** needs another Foundry ("needs Foundry 14.372;
    you have 14.369 · Foundry's update"), or a dependency that isn't
    installed ("needs Monk's Common Display · Install…").
  - **Not available to you:** see "Access you no longer have". Each row
    has its way back (Check again or Try again).
  - **Couldn't check:** see "When the check gets no answer".
  - A line at the foot: "1 locked module isn't checked" (Foundry's lock
    skips it, as Foundry's Update All does).
- **Actions are buttons, links only go somewhere** (owner, 2026-11-27: a
  "Check again" link read like "Foundry's update"). A row's action (Check
  again, Try again, Install…) is a button in the row's right-hand column,
  where its progress shows during a run. A warning's fix is a button in
  the same column, naming what it ticks ("Tick D&D 5e too"), so every
  action shares one right edge and sits centred in its row (owner,
  2026-11-27: fix buttons placed after the warning text floated
  mid-row).
  Changelog, a project page and Foundry's update stay links. The section
  headers' Tick all and Untick all stay links, as Undo all and Remove are
  elsewhere on the page.
- **The list keeps its place** while rows change (owner, 2026-11-27:
  Check again scrolled to the top and hid the row's progress). A row that
  moves to Ready is brought into view.
- **Foot:** "Back up first" (Foundry's own package backup of the ticked
  packages), "5 ticked", **Update 5**.
- **After an update:** a summary at the top ("4 updated · 1 failed ·
  backups in Backups › Modules") and an "Updated just now" section.
- **Nothing to update:** "Everything is up to date · checked just now".

The Modules and Systems tabs lose their Update All button; the Updates tab
replaces it. Foundry's own Update All stays behind the extension's on/off
switch, as the rest of Foundry's page does.

### Progress

Updating shows where the owner is looking:

- each row on the Updates tab: queued, backing up, downloading with a
  percentage, installing, updated, or failed with Foundry's reason;
- the foot: "Updating 2 of 5 · 40%";
- the Updates tab label (a spinner and "2/5") and the rail's Library line
  ("Updating 2 of 5…"), so other pages show it too;
- the card's arrow chip becomes the package's progress;
- the module or system panel's Update box.

Worlds wait while updates run ("Waiting for the updates to finish" on
Launch), as they do for a backup: a world launched mid-install would load
half a module.

The check has its own progress (the head's bar), so a slow manifest reads
as slow, not stuck. Foundry's server gives up on a manifest after 5
seconds, and its page gives up on the server after 20, so no row waits
longer than that before it says "Couldn't check".

### A single package

- **The panel's Package tab** opens with an **Update** box in place of
  "Update if available":
  - not checked yet: **Check for update**;
  - checking: a spinner;
  - up to date: "Up to date · checked 4 minutes ago · Check again";
  - an update: "0.12.0 available · you have 0.11.0 · Changelog", its
    warnings, Back up first and **Update to 0.12.0**;
  - blocked or not available: the reason, as on the Updates tab.
- **The arrow chip on a card** opens that panel on the Package tab rather
  than installing at once. No popover (the owner removed popups from the
  page before).

### Warnings before updating

A pure model in `packages/shared` compares the check's remote manifests
with what is installed and what is ticked:

- **Needs another Foundry:** blocked (Foundry refuses it too).
- **Doesn't fit your system version:** Foundry's own `systemCompatibility`
  from the check, shown before installing rather than mid-update. If the
  system has a ticked update that fits, the warning says so and clears.
- **A system or library update leaves dependents outside their ranges:**
  installed modules whose manifests declare the system (or library) with a
  `maximum` below the new version: "2 modules declare D&D 5e up to 5.1:
  Tidy 5e Sheets, SRD Battlemaps". A dependent that has an update which
  fits gets "Tick it too".
- **Needs a newer library:** a `requires` entry whose `minimum` is newer
  than the installed library and not met by a ticked update: "Needs
  libWrapper 1.13 or newer (you have 1.12.4) · Tick it too".
- **Needs a library that isn't installed:** can't update here; Install…
  opens Foundry's installer.
- **Not verified for this Foundry:** a note, not a warning (Foundry
  installs it).

Rows with a warning start unticked; ticking one is the owner's choice.
Updates install libraries and systems before the modules that need them.

### Asking before an update that may break something

Owner, 2026-11-27: "Why is there no confirmation menu for the system
breaking one of the modules that has no updates yet?" A warning on a row
is easy to miss after Tick all, so Update (and the panel's Update to X)
asks first whenever a package in the run still has a warning, judged on
that run alone.

- **Both directions:** a system or library update that leaves installed
  modules outside the versions they declare (SRD Battlemaps, or a content
  module such as the Player's Handbook that declares dnd5e up to 5.1), and
  a module update that needs a newer system or library than the run gives
  it (Tidy 5e Sheets, or a new Player's Handbook needing dnd5e 5.2). The
  module type doesn't matter: it is what its manifest declares. Foundry
  asks only in the second case, and only for systems.
- **The dialog** (Foundry's DialogV2 look) names each risky package, what
  it would leave behind and where that is on ("SRD Battlemaps is on in 1
  world"), and whether Back up first is on. Choices: Cancel; "Update the
  other 6" (leaves the risky ones out, unticked); "Also update D&D 5e"
  when every risk has a fix (the bigger run is judged again, so adding
  D&D 5e asks about SRD Battlemaps next); "Update all 7 anyway". The
  highlighted choice is the safest one that still updates; "anyway" is
  highlighted only when nothing safer exists.
- **What "may stop working" means:** Foundry gives a module outside its
  declared system versions availability 3 (a warning badge) and still
  loads it, so whether it works is up to the module. The dialog says so,
  and after the update the module's card says "Declares D&D 5e up to 5.1;
  you have 5.2.0".
- The panel's Update box shows the warning without tick buttons: it
  updates one package, so its confirmation offers the fix instead.

### Access you no longer have

From certain to learned:

1. **Premium content sold on foundryvtt.com**, including subscriptions
   Foundry's site tracks: Foundry's package list says whether the license
   owns it (`owned`, from Foundry's owned-packages request). Not owned:
   "Premium: your Foundry account doesn't have it. Bought or renewed it?
   Check again", before any attempt.
2. **A manifest behind a personal key** (a Patreon link): the check comes
   back with 401 or 403: "The manifest refused access. A membership may
   have ended. Renewed it? Check again."
3. **A public manifest with a locked download:** can't be known without
   trying. Testing the download would mean Stagehand contacting the
   creator's server itself (a new host permission and a privacy policy
   change), so instead a refused install (401 or 403) is remembered for
   that version: "The download was refused (403), so it isn't ticked for
   you any more. Renewed your access? Try again."

**Getting the update after renewing** (owner, 2026-11-26: "What if I see
that and go renew my subscription?"):

- **Check again** (cases 1 and 2) checks that one package again, with its
  own spinner on the row. If the update is there now, the row moves to
  Ready, ticked and briefly marked, and the tab's count goes up. For
  premium content, Foundry's server keeps the owned list for 5 minutes,
  so a purchase can take that long to show.
- **Try again** (case 3) installs that package now, with the usual
  progress and backup. Remembering a refusal only stops Stagehand ticking
  it on its own; the owner can always try, and a newer version clears it.
- The same links show in the panel's Update box.

### When the check gets no answer

Owner, 2026-11-26: "Stagehand couldn't check, can I still try?"

- **Try again** on the row checks that package again. If it answers, its
  update joins Ready, ticked; if it is up to date, the row goes.
- A second failure says so: "Still no answer after 2 tries. Its site may
  be down: try later, or open its project page."
- Stagehand can't wait longer than Foundry: its server gives up on a
  manifest after 5 seconds (`TIMEOUTS.REMOTE_PACKAGE`), whatever the page
  asks.
- There is no "update anyway" without a check: Foundry's install fetches
  the same manifest first and would fail the same way, and without an
  answer there is no version to show or warnings to work out.

### What stays Foundry's

The check (`checkPackage`), the install (`installPackage`), the backup
(`createBackup`), the lock, the protected-content download and all
manifest rules are Foundry's. Stagehand decides what to show, what to tick
and in which order to install; it never fetches a manifest or a download
itself.

## Foundry facts this relies on

Read in 14.370 (`public/scripts/foundry.mjs`, `dist/packages/views.mjs`,
`dist/packages/package.mjs`); 13.351 has the same client calls
(`checkPackage`, `installPackage`, `systemCompatibility`).

- `game.checkPackage({type, id, manifest?, timeout = 20000})` posts
  `/setup` `checkPackage`. The answer: `remote` (the remote manifest),
  `isUpgrade`, `isDowngrade`, `availability`, `manifest`, `hasSidegraded`,
  `systemCompatibility` (modules: per related system `{id, title, version,
compatible}`), or `error` and `errorCode` (401, 403, 404, 500 from the
  manifest fetch). It follows foundryvtt.com's index when that lists a
  newer version at another manifest.
- Foundry's updater (`SetupPackages#updateCheck`): availability 7 to 10
  (another core) is refused with an info message; an upgrade with
  availability 4 or below is an update; everything else is "current".
- `game.installPackage({type, id, manifest, notify})` posts
  `installPackage`. The server checks the manifest again, refuses another
  core and downgrades, asks foundryvtt.com for a protected package's
  download URL with the license, then downloads and installs with progress
  (`SETUP_PACKAGE_PROGRESS.ACTIONS.INSTALL_PKG`). It does not check
  dependencies.
- `game.getPackages({type})` returns foundryvtt.com's index entries with
  `availability` and, for premium entries, `owned`. The client caches it
  (`game.packageCache[type]`) for the page; the server caches the index
  and the owned list for 5 minutes.
- Foundry's Update All skips locked packages and packages without a
  manifest, and runs five checks at a time.
- A module whose declared system versions don't include the installed
  system gets availability 3 (`UNVERIFIED_SYSTEM`): a warning badge on
  Setup; it isn't unavailable (that starts above 4) and still loads.
  `testDependencyCompatibility` checks only `minimum` and `maximum`;
  `verified` is advice.
- The server fetches a remote manifest or download with a 5-second
  timeout (`TIMEOUTS.REMOTE_PACKAGE`); the page's `checkPackage` waits 20
  seconds for the server.

## Build

- **Page world** (`packages/extension/src/page/`): `package-check.ts` runs
  `checkPackage` for a list (five at a time, Stop), normalises each answer
  and posts `CHECK_PROGRESS` and `CHECK_RESULT`; `package-install.ts`
  installs a list in order with `installPackage`, after `createBackup` when
  asked. Adapter flags per Foundry version (`packageCheck`,
  `packageInstall`), 13 in `compat/v13`.
- **Protocol** (`page-protocol.ts`): the new messages, checked both ways
  as today.
- **Shared model** (`packages/shared/src/updates/`): the result type, the
  sections, the warnings and the install order. Pure, unit tested.
- **Store and storage:** the last check per server (results and time) and
  the refused downloads, in the extension's storage (the app's platform
  storage), not the library file.
- **UI** (`packages/extension/src/ui/shell/library/updates/`): the tab,
  rows, head and foot; the panel's Update box; chip progress; the rail
  line; Launch waits. Phone and tablet get the same list, with the foot in
  the dock, in the same phase as the desktop.

## Phases

1. **Progress for today's buttons.** Draw the `installPackage` progress
   Stagehand already receives: on the card's chip, the panel, the Library
   line on the rail; Launch waits. Fix the marks to what Foundry installs
   (availability 4 or below). Small; can ship as a fix release. Done
   2026-11-27: an install's tick names its package in its `title` (its id
   is the manifest URL), which is why no card could show it before; the
   rail says "Installing…" for a package not yet installed. The check
   before Foundry's install (Update All's silent part) still shows
   nothing until phase 2 replaces it with our own check.
2. **Check.** The page-world check with progress and Stop, checking one
   package again (Try again, Check again), the results store, the Updates
   tab read-only (sections, Check again), marks from the check, ownership
   from the package list.
3. **Review and update.** Ticking, Back up first, installing the ticked
   packages in order, per-row and overall progress, the summary; the
   panel's Update box and the chip opening it; Update All goes.
4. **Warnings.** The shared model: dependencies, system impact, "Tick it
   too", Foundry's `systemCompatibility` up front, and the confirmation
   before a run that still has warnings.
5. **Access.** Refused downloads remembered; the "Not available to you"
   wording for all three cases, each with Check again or Try again.

Each phase: unit tests, the live suites on 14 and 13, the app suite, then
a commit.

## Tests

- Unit: the check normaliser (each availability, errors, sidegrades), the
  warnings model, the install order, the store.
- UI (happy-dom): the tab's sections, ticking and fixes, the Update box's
  states.
- Live (Playwright, private servers): fixture packages served by a small
  local HTTP server the test starts, so updates are real and repeatable:
  one with a plain update, one whose new version needs a newer library, one
  that needs Foundry 99, one whose manifest answers 403, one whose download
  answers 403. Check, tick, update, progress seen, versions changed after.

## Defaults

Shown in the approved mockup, so approved with it:

- Back up first: on.
- Rows with a warning start unticked.
- The tab checks again on opening when the last check is over an hour
  old; Setup load keeps the quick package-list check for the marks.
- No Update All button on the Modules and Systems tabs.

Not visible in the mockup, so still a proposal for the owner to confirm
when the phase gets there:

- Back up first is remembered per browser.
- Refused downloads are remembered in this browser, not the library file
  (phase 5).

## Risks

- More of Foundry's internals than today's button presses
  (`checkPackage`, `installPackage`, the package cache): per-version
  adapter flags and the live suites on both versions.
- A full check fetches every manifest (Foundry's Update All does the
  same); it runs on request or when stale, never on every load.
- Warnings are only as good as what manifests declare; the Changelog link
  and Back up first cover the rest.
- Installing outside Foundry's Update All means Foundry's results dialog
  doesn't appear; our summary replaces it.

## Not in scope

- Updates inside a world (the companion): Setup only.
- Downgrading, or picking an older version.
- Foundry's own update (the Update page covers it).
