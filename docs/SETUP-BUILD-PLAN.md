# Building the new Setup page

Status: started 2026-11-06. Design: `docs/SETUP-REDESIGN.md`. Foundry facts: `docs/SETUP-SPIKE.md`.
Mockup to match: `design/setup-page/` (playground: https://claude.ai/artifact/YKaVJnZdr1zsju86XQSpBT).

## Approach

- **Same extension, new surface.** The page is drawn by the existing content scripts:
  `setup-ui` (isolated world, Preact) and `setup-main` (page world, Foundry's objects),
  talking over the checked `page-protocol`. Store, background, commands, library, presets,
  Foundry windows, the launch path and i18n are reused, not rewritten.
- **Foundry stays underneath.** Foundry's Setup layout is hidden with CSS only
  (`#setup`, `#setup-menu`, `#main-header`, `#watermark`); its apps keep running, so hidden
  buttons, menus, hooks and progress events still work (SETUP-SPIKE.md).
- **The page whenever the extension runs** (owner, 2026-11-06; until then it was opt-in
  with a "Foundry's Setup page" switch back). Turning the extension off gives Foundry's
  page. Any error while mounting leaves Foundry's page alone with one notice. Safe mode
  (unknown Foundry generation) never takes over the page.
- **Internal Foundry hooks behind the remote config**, each with a fallback: hidden button
  selectors, `editWorld`, menu wrapping. Public `game.*` calls are preferred everywhere.
- **Every phase:** tests first (Vitest, Testing Library style for components), `pnpm verify`,
  the live Playwright suite against Foundry 14 (`pnpm test:foundry`), a code review and a
  security review, a commit, and a short report with screenshots.
- **Build requirements** from SETUP-REDESIGN.md apply to every phase: real buttons and links,
  keyboard reachable, page updated in place (no focus loss, no lost clicks), live region for
  queued changes and saves, explanations on disabled controls via a wrapper, nothing moving
  under the pointer, many-worlds layouts, Foundry's world order.

## Phases

| #   | Phase               | Scope                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Done when                                                                                                                      |
| --- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Shell**           | Opt-in setting; take over and restore Foundry's layout; header bar (logo, version chip, Backups and Configuration opening Foundry's own windows for now, ⏻ menu for Log out and Shut down); worlds rail in Foundry's order with favourites, filter and status flags; Library entry; routing between a world and the Library; the Library shows today's Module Library UI; a world shows a banner (title, system, last played, Launch) and today's world sheet content. | The new page runs on Foundry 14 with every current feature reachable; switching back restores Foundry's page; live tests pass. |
| 2   | **World page**      | Modules tab: calm cards with switch and "why" line, groups, All/On/Changes, Add ▾ (preset, copy from world); queued changes as per-module commands; banner pending line; review-at-launch dialog with Back up first; empty state without the companion.                                                                                                                                                                                                                | Changing modules on a world needs no window; the launch review shows and applies the queue.                                    |
| 3   | **Library**         | New cards, calm group headers, module details panel (Library and Package tabs), selection band, intake for new installs, By world grid with Show filter.                                                                                                                                                                                                                                                                                                               | Library parity with the mockup, existing organisation features intact.                                                         |
| 4   | **World details**   | About tab edited in place (`editWorld` behind remote config, fallback to World Configuration), next-session picker and schedule (stored in the world's `flags`, moved forward when Setup opens), Favourite and Lock, Backups tab (public backup calls, progress from Foundry's socket, locking).                                                                                                                                                                       | About and Backups work without Foundry's windows.                                                                              |
| 5   | **Server pages**    | Backups (snapshots and package backups), Configuration (`adminConfigure`, restart notice, Shut down now), Update (release notes reader, history from foundryvtt.com with optional host permission, compatibility preview).                                                                                                                                                                                                                                             | Foundry's Backup Manager, Configuration and Update screens are no longer needed.                                               |
| 6   | **News and finish** | News and Featured Content at the foot of the rail, read state; accessibility pass; 1280 and 1366 layouts and wide screens; many worlds; make the new page the default.                                                                                                                                                                                                                                                                                                 | Acceptance: every requirement in SETUP-REDESIGN.md checked on Foundry 14.                                                      |

## Phase 1 detail

- `setup-main`: `SHELL_ENTER` / `SHELL_EXIT` (add or remove a body class whose CSS hides
  Foundry's layout); `FOUNDRY_ACTION` with an allow-list (`configure`, `backups`, `update`,
  `adminLogout`, `shutDown`, `worldCreate`, `worldEdit`, `favourite`, `launch`) that clicks
  Foundry's hidden controls or calls its public API; collect favourites, locked state,
  background and `lastPlayed` for worlds.
- `setup-ui`: a `ShellRoot` mounted into its own full-page host; header, rail, router;
  `worldOrder()` (favourites, last played, never played, title) as a tested pure function.
- Options page and Foundry's page: a "Try the new Setup page" switch; the header has
  "Foundry's Setup page" to switch back.
- Tests: world order, protocol parsing for the new messages (both directions), shell
  enter/exit and restore on mount error, rail filtering and flags, routing; live: take over,
  open a world, open the Library, switch back.

## Progress

### Phase 1: shell (done)

Done (`34388ff`):

- World data: `favorite`, `locked`, `background` in `WorldInfoSchema`, read by
  `page/collect.ts`.
- `ui/model/order.ts`: `worldOrder(worlds, lang)`, Foundry's order.
- `page-protocol.ts`: `SHELL` / `SHELL_STATE`, `FOUNDRY_ACTION` with `SERVER_ACTIONS`
  (configure, backups, update, logout, shutdown, createWorld) and `WORLD_ACTIONS` (launch,
  editWorld, favorite).
- `page/shell.ts`: `setShell(doc, on)`, CSS-only take-over, refuses if `#setup` or
  `#setup-menu` is missing.
- `page/actions.ts`: `runFoundryAction(doc, page, action)`.

Also done: `entries/setup-main.ts` handles `SHELL` (replies `SHELL_STATE`) and
`FOUNDRY_ACTION` (Foundry notification on error); `page/globals.ts` types Foundry's
settings, `Collection.get` and `WorldConfig`.

Also done (`25fed37`, live test `18c7b06`):

- Per-server preference `newSetupPage` (`Prefs` in `messages.ts`, `state.prefs` /
  `setPref`, `set-pref` accepted from the Setup page without admin verification, since it
  only changes this browser's view). `actions.setPref` in the UI.
- "Try the new Setup page" in the Module Library toolbar (not offered in safe mode).
  "Foundry's Setup page" in our header switches back.
- `ui/shell/`: `Shell`, `Header` (logo, version chip opening Foundry's update screen,
  Backups, Configuration, power menu with Log out and Shut down), `WorldRail` (Library
  entry, worlds in Foundry's order, filter, Create World, favourite, lock, queued and
  attention flags, artwork thumbnails), `WorldPage` (banner with artwork, system, core,
  last played, lock, favourite star, Edit World, Launch; today's sheet sections via
  `SheetSections`; Apply presets), `route.ts` (`resolveRoute`, `filterWorlds`,
  `cssImage` for same-origin artwork only), `mount.tsx` (`syncShell`: ask, wait for
  `SHELL_STATE`, render; refusal or render error keeps today's UI with one notice; an
  error boundary gives Foundry's page back on later errors), `shell.css` (appended to
  `setup-ui.css` by `build.ts`).
- Store: `route` (`library` or a world). The Library route renders today's `ModulesView`.
- Live test `tests/foundry/setup-shell.spec.ts`: turn on, world page, Edit World window
  above our page, Library, Configuration window, reload keeps it, switch back.

Deferred: the switch on the options page. The options page has no per-server list yet;
the switch lives in the Module Library toolbar and our header instead.

Open item: our power menu is always shown, but Foundry only offers Log out and Shut down
when an admin password is set (SETUP-SPIKE.md); without one the action reports a missing
control. Collect that flag and hide the menu then (Phase 5, server pages).

### Phase 2: world page (done)

Done (commits from `1290e9f`):

- Background: `launch-hold` (Setup, admin-gated) sets a per-world hold; the world's next
  `COMMANDS_PULL` gets no commands and uses the hold up. "Launch without changes" sets it;
  "Apply and launch" clears a stale one first.
- Page world: `backupLaunch` runs Foundry's public `game.createBackup(world, {note})` and
  launches only if it finished.
- `ui/model/world-modules.ts`: each module on now (snapshot) and after the next launch
  (queue resolved like the companion), delta, problem flag and the "why" reason
  (companion, blocked, needs, conflict, needed by, preset, not verified, note, authors;
  packages carry no description, so authors are the quiet fallback). `flipModule`
  undoes a module's own single-module change before queuing a new one.
- `ui/shell/world/`: Modules tab (filter, All / On / Changes, folder sections, cards with
  a switch, a why line and its fix, live region), Add (a preset; copy another world:
  match or add), launch review (problems or "dependencies met", turns on / off, presets,
  Back up first, Launch without changes), not-set-up state. Banner: pending line with
  Review and Discard, change count on Launch. `world.css` appended by the build.
- Live: `tests/foundry/setup-world.spec.ts` (seeded snapshot) and the last test of
  `apply.spec.ts` (Launch without changes: no confirm in the world, change stays queued).

Not yet: About and Backups tabs (Phase 4), progress of Foundry's backup on our page (its
own notification shows), a group's "turn all on/off" menu, and View options from the
mockup.

Reviews (code, security): no critical or high findings. Fixed: a read-only browser
launches from the review without a hold; queued changes that change nothing still show,
can be discarded and are reviewed; holds expire after ten minutes; a second flip while
saving is ignored; copying more than `MAX_PICKED` modules is refused with a reason; modals
take focus, trap Tab, stop Escape and return focus.

### Phase 3: Library (done)

Done (commits from `556a1d7`):

- `ui/model/library-groups.ts`: group by folder, tag, author or smart group.
- `ui/shell/library/`: Library page with tabs Modules and By world, filter, Group by, the
  count, Select (checkboxes and today's bulk bar), Organise (today's folders, tags,
  presets, import and export in the side slot). Calm cards (name, one line: not verified,
  note or authors; up to three tags; version; worlds it is on in). A module's name opens
  its details (Library tab: folder, tags, note, presets, a switch per tracked world;
  Package tab: version, compatibility, authors, relations, links).
- By world grid (`ui/model/world-grid.ts`, `WorldGrid.tsx`): worlds in Foundry's order,
  a switch per cell, Show filter (all, favourites, last 3 months, with changes or
  problems, chosen), hidden worlds with changes named, Show all when empty, pinned module
  column and header, 92px minimum columns.
- Intake: the background remembers sorted modules (first Setup visit seeds all as
  sorted); `fresh` in the Setup state; `modules-sorted` (admin-gated). A band and New
  marks on the cards; Sort them lists each new module with folder and tags.
- Live: `tests/foundry/setup-library.spec.ts`.

Not yet: Foundry's favourite and lock for modules, an Update button on modules with
updates, intake suggestions ("same family as"), Systems tab, group-header menus (rename or
recolour a folder from its header), group counts per world in the grid, a fade at the
grid's cut-off edge.

Reviews (code, security): no critical or high findings. Fixed: sorted-module storage is
bounded (ids max 200 characters, lists max 5000, only installed ids, seeded only by an
admin visit); changes and holds for unknown worlds are refused; the filter clears the
selection; the intake panel closes; notes resync; the companion is locked in the panel;
grid keys and lookups.

Open (security, from Phase 1 design): any script on the Setup page can post Setup data
claiming `isAdmin`, which unlocks our admin-gated writes. Hostile code in the admin's own
Setup session already has Foundry's admin powers, so this widens little, but a per-load
channel (MessageChannel or nonce created by the isolated script) should replace the
open `postMessage` for SETUP_DATA. Also open: tab keyboard pattern (arrow keys,
`tabpanel`) for the Library and module panel tabs.

### Phase 4: world details (done)

Done (commits from `92eda91`):

- World data: description (cut at 20000 characters) and next session.
- `ui/common/rich-text.tsx`: descriptions rendered through a whitelist rebuilt as Preact
  elements (no innerHTML, no attributes but checked http(s) links, no images, frames,
  scripts or styles); plain text keeps its paragraphs.
- World page tabs: Modules, About, Backups. The banner's pencil opens About.
- About: cleaned description (folded when long), Foundry's details, next session in local
  time with its zone (24-hour). With the adapter flag `editWorld` (on for V14): title and
  next session edited in place and saved through Foundry's `editWorld` (`SAVE_WORLD` /
  `SAVE_DONE`, validate first, then re-render). Without it: Foundry's World Configuration.
- Backups: Foundry's backups of the world (`BACKUPS` / `BACKUPS_DONE`): list, Take a
  backup, Restore, Delete through Foundry's own dialogs; a snapshot's backup can't be
  deleted alone. Live: take one, cancel a restore, delete it with the code.

Not yet: description editing (Foundry's prose-mirror lives in the page world, so it needs a
window or a page-world editor), background picker, join theme, safe mode and reset
passwords (one-shot flags), Lock switch, the next-session schedule (repeats and chosen
dates, stored in the world's `flags`, still untested live), progress drawn on our page and
mirroring Foundry's lock during backups, multi-select delete, the "a backup covers the
queued changes" nudge.

Reviews (code, security): no critical or high findings. Fixed: the Backups tab keeps its
list on errors and stays mounted once opened; backup records clamped to the reply schema;
editors stay open until saved; dates survive odd language tags; description links show
their host; nesting deeper than 32 is flattened. Noted: our SAVE_DONE / BACKUPS_DONE
replies can be forged by page scripts (cosmetic only: real state comes from Setup's data).

### Phase 5: server pages (done)

Done (commits from `1eae2b8`):

- Backups page (header Backups): Snapshots (note, Foundry version, package count, size;
  take, restore, delete through Foundry's dialogs), then Worlds, Modules and Systems with
  each package's backups inline (uninstalled ones marked). `SERVER_BACKUPS` / `_DONE`;
  package backups name their type. Foundry's Backup Manager one click away.
- Configuration page (header Configuration): Foundry's settings grouped by task, edits in
  a not-saved bar, saved through Foundry's `ServerSettings` model and `adminConfigure`
  (only the diff; the model restored on failure), then the restart notice with Shut down
  now. `CONFIG` / `_DONE` carries an allow-list only: never the password hash, salt or
  certificate keys (only whether a password is set). The password itself is changed in
  Foundry's window.
- Update page (Version chip, marked when an update exists): installed version, channel,
  availability, Foundry's public release notes, Foundry's own update screen. Only the
  update check's `hasUpdate`, `channel` and `version` are read, never its download link.
- Live: `tests/foundry/setup-server.spec.ts` (snapshot taken and deleted; a setting saved
  and restored; Update page).

Not yet: password change flow on our page (current → new → repeat), HTTPS status and
certificate actions, AWS, the release notes reader and history (needs the optional
foundryvtt.com host permission), the compatibility preview (needs Foundry's release data
from its update check), snapshot creation details (disk needed and free), and progress
drawn on our page.

Reviews (code, security): no critical or high findings. Fixed: package operation errors
survive the re-list; uninstalled packages' backups can be restored and deleted; own-key
snapshot lookups; port validation blocks Save; trimming at save; the restart notice
accumulates. Open: unsaved Configuration edits are dropped when leaving the page.

### Phase 5b: prototype parity (done)

A side-by-side check of the build against the prototype at 2560 and 1366 wide (report:
https://claude.ai/artifact/NwhDMdn4e6vaTPb9TLF1Mf) found 11 bugs, 17 gaps and 8 differences
recorded as "deliberate". The owner's rulings (2026-11-06):

- **The prototype is the spec.** A difference is a decision only if the owner approved it.
  Items deferred in Phases 2 to 5 are done now, not carried.
- **No way back inside the extension.** "Foundry's Setup page" goes; the new page is the
  page whenever the extension runs (turning the extension off gives Foundry's page). Safe
  mode and a failed mount still leave Foundry's page alone. The old Module Library UI on
  Foundry's tabs goes with it.
- **No Foundry fallbacks on our pages:** "Foundry's Backup Manager", "Foundry's Application
  Configuration", "Edit in Foundry", "Change in Foundry", "Update in Foundry…" go; the
  features they stood in for are built.
- **Build label** only in dev builds.
- **Library toolbar** as designed (Select, Collapse all, New folder, Tags, Presets, Export),
  not today's Organise slot. The "Cards / Foundry's" switch is dropped.
- **Version chip** as designed: a menu with the update and Help.
- **Configuration** follows Foundry's window and the prototype (fields Foundry's window
  hides are not shown; Backups is set at server start); rechecked once it matches.
- **One confirmation at launch.** The review on Setup is the confirmation. The companion
  re-checks in the world and applies at once with a notice; it asks again only if the live
  check differs from what was reviewed (conflict, missing dependency, modules changed in
  the world meanwhile).

Work packages, each committed on its own:

1. Rulings above: default page, removals, dev-only build label, chip menu, one confirmation.
2. Bugs: compatibility levels as Foundry rates them (UNVERIFIED_BUILD is neutral), system
   titles, Update page with updates disabled, server backups titles, sizes and empty
   packages, page headings, note font, star beside the title, Configuration columns, grid
   group rows.
3. World page: tab icons and counts, filter row in the tab bar, group menu, View options,
   launch review extras (drop one change, preset named, backup size and age).
4. About: description in prose-mirror, background picker, Maintenance (data, safe mode,
   reset passwords, Lock), next-session schedule, join screen, system, Danger zone.
5. Backups: world tab (nudge, summary, multi-select, tags, progress with Foundry's busy
   lock) and server page (category tabs, Select, filter and sort, disk free, create flow,
   progress).
6. Library: Install Module, Update All, Systems tab, Update button, module favourite and
   lock, toolbar, group menus, module panel and grid extras, descriptions, Library entry.
7. Server pages: Configuration (help text, password change, HTTPS, AWS, Advanced) and
   Update (notes reader, your packages, history, snapshot first, states, progress).

Package 1 done: the new page is the page (no preference, no switch back);
the old UI on Foundry's tabs, its world-card menu and tags, and their tests,
CSS and strings are gone; no "Foundry's …" buttons; the Version chip's menu
(build, channel, update, Help: Foundry's Package Warnings window, the
knowledge base); build label only in dev builds (`pnpm build:release` drops
it); one confirmation at launch (`launch-hold` carries `reviewed`, installed
ids only; the companion applies without its dialog when the live target
equals it and nothing needs a choice). Live: `apply.spec.ts` rewritten for
the new page (reviewed launch applies with no dialog; a remove others need
still asks), `setup-ui.spec.ts` removed with the old UI; library
organisation gets live tests again with package 6.

Security (review of package 1, MEDIUM, owner to decide): a script running in
the admin's Setup page can already pass our admin gate by posting Setup data
that claims `isAdmin` (open since Phase 3). Before, it could only queue
changes and the GM confirmed them in the world; now it can also mark them
reviewed, and they apply without the in-world dialog. Closing it means the
per-load private channel between `setup-main` and `setup-ui` (a MessageChannel
created at `document_start`, before any page script runs) or an in-world
confirmation for modules never enabled before. The reviewed intent also lives
up to ten minutes and is used by the world's next launch from this browser,
even one started from Foundry's own page (limited to exactly what was
reviewed).

Package 2 done (`d4fd0cd`..): compatibility as Foundry rates it (a newer
build of the verified generation is neutral; `isCompatibilityRisk`), system
titles, the Update page's channel and its disabled or unreachable states,
server Backups listing only packages with backups by title, server page
headings in Foundry's display face with a summary line, the star and Locked
tag beside the world's title, Configuration in two columns, foldable grid
group rows shared with the Modules tab, "companion off" world columns.
Found on the way: Foundry never saves `noBackups` (options.json drops it), so
Backups is set at server start, as the prototype says (package 7). Reviews:
no critical or high; fixed the star inside the heading, the repeated
"couldn't reach" line, "Foundry 0" without a version, and bounded world and
system names in Setup data.

Package 3 done (`4cc07de`, `d0d2a12`): the module details as their own column
(Library and world pages; every world listed, "companion off", this world
marked), the world page's tab row with icons, counts and its tools, a group's
"Turn all on / off", View options (group by, cards or list), and the launch
review's drop (×) and latest-backup line. Reviews: no critical or high;
fixed "Turn all on" queueing modules that can't turn on, a second flip while
one is saving (now ignored for every caller), focus after a drop, the panel
outliving its module, overlapping backup calls, popovers closing on Tab,
groups over 500 modules (queued in parts), and queued module ids kept only if
installed.

Package 4 in progress, in three steps: 4a About layout (two columns),
Details (Rename, Game system and Join screen Change, made for, last saved
with, played for, size, folder), Background (Foundry's file picker,
`pickBackground` action), Maintenance (data, safe mode, reset passwords with
an in-place confirm, Lock via `lockPackage` behind its adapter flag), Danger
zone (`deleteWorld` = Foundry's uninstall dialog), a locked world's
disabled controls; 4b description editing in Foundry's prose-mirror (mounted
by the page world); 4c the next-session schedule (`world.flags["module-
library"].schedule`, moved forward when Setup opens). Done so far for 4a:
save protocol fields, collected world fields (joinTheme, safeMode,
playtime, verified), page-world actions lock/unlock/deleteWorld/
pickBackground. 4a done (`7e43b7b`): the About layout and boxes. 4b done
(`e92c423`): Foundry's prose-mirror mounted by the page world in an
`ml-pm-` host (EDITOR_OPEN / EDITOR_SAVE / EDITOR_CLOSE), live-tested. Next:
4c, the schedule (port `design/setup-page/src/_sched.js`: `zonedToUtc`,
`upcoming`, `nextOf`, `ruleText` as a pure tested model; the session box
with the next date, rule, upcoming list with Skip / Remove; the editor with
calendar, 24-hour time, quick times, time zone list and search, repeats none
/ weekly / 2 weeks / monthly / chosen dates; saved as `flags` via editWorld
plus `nextSession`; moved forward on Setup open). Then reviews for package 4. 4c done: the
schedule model, its storage in the world's flags, the Next session box (view
with the zone named, the rule and Skip / Restore / Remove; editor with
calendar, Repeats, 24-hour time and quick times, time zone list and search),
and moving a passed date on when Setup opens. Found live: Foundry's client
merges editWorld's answer, so a "-=" deletion has to be applied to the
client's copy too (`saveWorld` applies our changes, then the answer).
Package 4 reviews: code (one high) and security, no critical. Fixed: a rule
started long ago now jumps to its next dates (it gave up after 120 steps and
the sync then cleared Foundry's date); monthly rules on the 29th to 31st use
the month's last day; "today" in the editor is the viewer's date; a removed
chosen date is deleted with a "-=" key per date (live: Foundry merges
objects, and a delete and a set of the same key in one request leaves
nothing); the sync only moves a missing or passed date, compares instants
and skips a schedule whose math fails; the zone search works by keyboard; a
description Setup had to cut isn't offered for editing; descriptions are
cleaned (no attributes but checked links and image sources) before Foundry's
editor opens them; a schedule's zone must be one the browser knows; the page
world refuses Foundry writes unless Setup is the admin's.

Package 5 (Backups) plan, from `design/setup-page/src/_calm.js` calmBackups
and `src/_server.js`:

- Progress and lock: the page world listens to `game.socket.on("progress")`
  (SETUP-SPIKE.md: "Backup In Progress <package> 47%") and posts PROGRESS
  {action, packageId, pct, step} to the UI; a running backup or restore locks
  Restore, Delete and Launch (reasons on wrappers), as Foundry's `toggleLock`.
- World Backups tab: nudge when changes are queued ("Back up now"; turns
  "done" when a backup is newer than the queue's latest command), empty
  state ("No backups of X yet", Take the first backup), head "N backups ·
  latest X ago · size in all" with Select (multi-delete through one
  `deleteBackups` call) and Take a backup, rows with name or date, date and
  time, age, "latest" pill, Foundry's version tag (BackupData
  compatibility.verified; older generation in yellow), size, Restore… and
  Delete (a snapshot's member: disabled with its reason), the progress row,
  and the footnote linking "All backups on this server".
- Server Backups page: tabs Snapshots / Worlds / Modules / Systems with
  counts and sizes, the snapshot lead line, Select (multi-delete snapshots),
  filter and sort by name, size or latest, version tags (older generation
  warns, newer can't restore), uninstalled packages marked, the create flow
  in Foundry's own dialog with our progress row.

Package 5 done (`3737397`, `63923af`). Progress comes from wrapping
`ui.setupPackages.onProgress` and `toggleLock` (every Foundry progress
receiver calls them, so one wrap covers backups, restores, snapshots and
updates); the store keeps running tasks and Foundry's lock. Only backup work
locks Restore, Delete and Launch; an install does not. The server page reads
free disk space from Foundry's `checkRestoreSnapshotDiskSpace` request asked
for nothing (one `statfs`), behind the new `diskFree` adapter flag, because
the create check sizes every package. A world route can open on its Backups
tab (`tab: "backups"`), for the server page's "Open X's Backups tab". Ages now
read in weeks, months and years (the prototype's "5 weeks ago"). Checked live
on 14.370: a world backup drew our row from 13% to 100% with Launch off, and
a snapshot drew Modules, Systems, Worlds with the package it was on.

Package 5 reviews: security (a lock message naming an object key crashed
the page; the progress wrapper could throw into Foundry's call) and code
(server package backups unsorted, so Restore latest could pick an older
one; a snapshot step without a percent kept the last step's; select-mode
counts and disabled reasons). All fixed (`4ce5744`, `d25abf0`).

Package 6 done, in parts: 6a head, toolbar and panels (`1e7b83c`), the
Foundry-window host removed with the old preset editor (`d760c4e`), 6b1
cards with Foundry's star, lock, updates and descriptions (`32d88a7`), 6b2
the Package tab (`1333e95`), 6b3 group menus (`c033198`), 6c1 Systems tab
and panel (`ea25e49`), 6c2 the By world grid's extras (`1dcf29c`). Notes:

- Organise is gone: Tags, Presets and New modules open in the panel column
  (store `side`), as the prototype. The selection bar replaces the toolbar
  while selecting. Library import and export, and preset import, sit in the
  toolbar's Import and export menu.
- Install Module and Install System open Foundry's own installer
  (`game.browsePackages`); Update All clicks Foundry's own button.
- Updates: once per Setup load the page world asks Foundry's package list
  (`game.getPackages`, one request per type, about 1.5 s) and keeps newer
  versions Foundry would install (availability 1 to 6), behind the new
  `updateCheck` adapter flag. Private packages not on foundryvtt.com get no
  mark; Foundry's own Update All still covers them.
- Package actions (update, favourite, lock, backup, uninstall) work for
  modules and systems as for worlds; Edit manifest reaches Foundry's
  ModuleConfig through its own card menu (not exported; see SETUP-SPIKE.md).
- Systems are read as packages (SystemInfoSchema: id, title and version
  required, the rest as a module's).
- Empty folders show on the Modules tab (unless filtering), so a new folder
  can be filled.
- Live: the Library suite covers the selection bar, Tags, Presets, a new
  folder end to end, Foundry's installer, the Package tab's favourite and
  Edit manifest, By world and intake.

Package 6 reviews: security (a description's out-of-range numeric entity
threw and lost the whole Setup read; one odd update version hid every
update mark) and code (Turn all could do nothing silently or queue twice;
bulk changes over 500 modules were refused; a stale selection, tag stages,
preset races, suggestions, the copied set, a gone system's panel, menu
roles, focus after rename). All fixed; each package is now read on its own,
and the update check runs once per Setup load.

Package 7, in parts: 7a Configuration (`af283f1`): only what Foundry's own
window edits, in two columns; the password changed after Foundry checks the
current one; HTTPS with Foundry's certificate actions; a save dialog that
lists each change, and Shut down now for changes that wait for a restart.
7b1 Update: what's new and the Update box:

- The page runs Foundry's own update check (`updateCheck`, posted to its
  `/update` route as its update screen does) on the configured channel when
  it opens, and again on a channel change. Nothing newer: up to date, with
  Check again. The release's download link never leaves the page world.
- What's new reads Foundry's release notes HTML: title, banner (only an
  https image on foundryvtt.com), the overview, sections and areas, issue
  numbers as GitHub links. Entries are drawn through the description
  cleaner, never as HTML. Search, Developer notes, jump links, folding.
- The Update box: Take a snapshot first (`game.createSnapshot` without its
  dialog; a failed snapshot installs nothing), Manual installation required
  (a new generation or a full reinstall), Updates disabled (`--noupdate`),
  the channel with Foundry's three, Advanced: force update. While it runs:
  the snapshot, then Foundry's four steps from its progress ticks, Setup
  locked; then what happens next.
- Found on the way: 7a never passed Foundry's password check result to the
  UI, so a right current password read as wrong. Fixed; a live test now
  covers the right password too.
- Live: up to date from Foundry's real check; Foundry's real notes answered
  as a newer build, read with the search; Updates disabled under
  `--noupdate`. The download itself can't run on the local server.

7b2 Your packages: Foundry's compatibility preview (`previewCompatibility`,
also on the `/update` route; it needs the release Foundry's check returned,
which the page world keeps, and takes about 5 s, so it is asked once per
release). Its availability codes read as the prototype's five statuses
(1 compatible; 2, 3 unverified; 4 and unknown a risk; 5, 6, 11 a missing
dependency; 7 to 10 incompatible). We add where each package is on (next
launch sets) and which modules of each world need a look; a world without
the companion has unknown modules. The summary box beside the notes, and
the full list with Systems, Modules and Worlds, chips and a filter. A row
opens the module's details, the system on the Library's Systems tab, or
the world. Only the fields shown cross from the page world, never a
description.

7b3 Release history: Foundry's public list at foundryvtt.com/releases and
each release's notes, read by the background with the optional permission
for foundryvtt.com (never with cookies; only those two kinds of URL; the
version is checked). This generation on your channel, or all channels;
marked installed, new, manual (Foundry's "Full"); the newest newer release
first, its notes with every section open. Deviation, by necessity: the
prototype asks for the permission when the tab first opens, but a page
script can't ask for one, so the tab explains and opens the options page,
whose button asks. Without it, the tab links to foundryvtt.com/releases.
Live: the denied state and the options page; with the permission granted
at install, Foundry's real list and 14.370's notes.

Package 7 reviews: no critical. Code: a failed snapshot could still let the
update install (one package's backup finishing read as the snapshot done;
Foundry's error answer has no tick), and a second update could start after
leaving the page mid-download. Fixed: only Foundry's own complete tick for
the snapshot counts, any error stops it; one download at a time in the page
world; the Update box shows Foundry's running update from its ticks and
waits while Foundry is busy; a download that stops ticking for 5 minutes
fails and gives the lock back. Security: a download must name the release
the page showed; release pages are fetched without redirects, from
foundryvtt.com/releases only, size-capped; package links show their host.
Also: a stale check can't replace a newer one, a failed configuration read
leaves a usable page, failed release notes can be read again, a port that
isn't one is left out of a save, non-JSON answers say so, and smaller
accessibility fixes. Left for later, with reasons: the tab rows' full ARIA
tabs pattern (Phase 6 accessibility pass, for every tab row at once); a page
script forging an answer to the UI (the MessageChannel decision with the
owner; no escalation, as page scripts can call Foundry directly); the
options page opening once per click on "Allow" (minor).

Phase 5b results: https://claude.ai/artifact/D4H4nCYeMMfJ3DJJtesL6b (private).
Owner, 2026-11-07: accepted; the small imperfections left are a polish pass
after Phase 6.

### Phase 6: News and finish (done)

Started 2026-11-07. "Make the new page the default" was done in Phase 5b package 1.

Where Foundry's news comes from (read from 14.370's `dist/core/update.mjs`,
`dist/core/game.mjs`, `dist/server/views/setup.mjs` and `SetupSidebar` in
`public/scripts/foundry.mjs`; no live spike needed): the server's update check
(`/_api/license/check/`, at most once a day from Setup) answers `news` and
`featured_content` with the release. The server keeps them in `Logs/news.json`
and sends them in Setup's data as `game.data.news` (a list) and
`game.data.featuredContent` (one item or null). Each item is
`{title, image, url, caption?}`; images are on `r2.foundryvtt.com`, links on
foundryvtt.com or foundryvtt.store. Foundry's own sidebar (`SetupSidebar`,
hidden under our page) draws them with links that open a new tab. Without a
check ever reaching foundryvtt.com there is no news ("No featured content").

Work packages, each committed on its own after `pnpm verify`, the live suite,
a code review and a security review:

1. **News and Featured Content** at the foot of the worlds rail, as the
   prototype (`design/setup-page/src/_calm.js` railNews, `_calm.css`
   `.mlr-news`, `.mlr-feat`). Setup data gains `news` (up to 20) and
   `featured`, read field by field: https links only, images only https on
   foundryvtt.com or its subdomains (else no image), titles cut. Read state
   is ours, per server, in the background: the URLs seen (bounded); the first
   Setup visit with news counts all as seen ("nothing new on a fresh
   install", SETUP-REDESIGN.md open item 3); opening any article marks the
   current ones seen. News is open while something is unread and folded to
   one line (latest title) after; the fold arrow or header wins for this
   load. Carousel of Foundry's 2.39:1 banners, sliding, preloaded, arrows and
   "1 / 4" over the banner, other slides inert, no motion with reduced
   motion. Featured Content: its own label and full banner, always open.
   Links open a new tab without opener or referrer. No news: the section is
   left out.
2. **Tabs** for every tab row at once (left from package 7): one shared
   `TabList` with the ARIA tabs pattern (tablist label, roving tabindex,
   Left / Right / Home / End move and select, `aria-controls` to a
   `tabpanel` labelled by its tab). Rows: world page, Library, module panel,
   server Backups, Update, Your packages' kinds.
3. **Accessibility pass** on every page: axe-core in the live suite (no
   serious or critical violations on the world page, Library, By world,
   Backups, Configuration, Update and their panels), keyboard paths through
   each page, focus visible everywhere and kept after actions, labels and
   names, contrast at least 4.5:1 for text (3:1 for large text and controls).
4. **Layouts**: 1280×800 and 1366×768 as the prototype (rail 240 px at 1280,
   the details panel over the page at 1280); wide screens as the prototype:
   the middle pane capped at Foundry's 1200 px window width, left-aligned
   beside the rail, header full width.
5. **Many worlds and modules**: a dev script that adds and removes test worlds
   and stub modules on the local server; the rail, the By world grid
   (`checks/gridwide.mjs`: 30 worlds, 92 px columns, pinned header and
   names, fade at the cut-off edge) and the Library with a lot of both;
   scrolling lists fade where they are cut off.
6. **Acceptance**: every requirement in SETUP-REDESIGN.md checked on Foundry
   14.370 and recorded below; the full live suite; the results artifact with
   the build beside the prototype at 1366 and 2560.

Package 1 done (`61ed0a7`, fixes after it). Live on 14.370
(`tests/foundry/setup-news.spec.ts`): a first visit has nothing new and News
folded to "2026 Year in Review"; an article forgotten from the read state
shows New and opens News; the arrows slide the track; an article opens
foundryvtt.com in a new tab and News reads as read after a reload; the fold
works by keyboard. Reviews: no critical or high. Fixed: article links only
to foundryvtt.com or foundryvtt.store (and subdomains), never with a user
name (security, medium: a forged item could put another site in Foundry's
news); one article per link; the URL cap shared; the carousel steps from the
slide shown when the list shrinks; opening an article keeps the section as
it is until the next load, so keyboard focus stays on the banner (the
prototype folds at once, but it is a mouse mockup); a right click no longer
counts as opening; the slide survives folding; the live region names the
article; the toggle keeps one name ("News") with `aria-expanded`. Kept, with
reasons: images from any foundryvtt.com subdomain (Foundry serves them from
r2.foundryvtt.com and may move them; the release notes banner follows the
same rule); a first visit without news seeds nothing, so the first news a
server ever gets is not New either ("nothing new on a fresh install").

Package 2 done (`ae6caf4`, fixes after it): `common/tabs.tsx` (`TabList`,
`TabPanel`) on the world page, Library, module panel, server Backups, Update
and Your packages' kinds. Tab rows are labelled ("World sections", "Library
sections", "Details of X", "Backup categories", "Update sections",
"Package types"); one tab in the Tab order; arrows, Home and End move and
select; the selected tab controls its `tabpanel`, which its tab names.
Layout checked unchanged with `scripts/dev/tab-boxes.ts` (every element's box
on every reachable tab, before and after; the only new box is the module
panel's tablist). Live: `tests/foundry/setup-a11y.spec.ts` walks the world,
Library, module panel and Backups rows by keyboard. Reviews: security none;
code no critical or high. Fixed: the panel wrapper shrank inside scrolling
parents and lost their end padding (About scrolled 16 px short), and broke a
child selector on the Update page; the panel is now `display: contents`, so
it has no box and changes no layout, and keeps its role and name (checked
in Chromium 156's accessibility tree); panels have no Tab stop of their own
(each holds controls); keys move from the focused tab; unit tests for the
Update page's two nested rows.

Package 3 done (`e9117ed`, fixes after it). axe-core (WCAG 2.2 A and AA) runs
in the live suite (`tests/foundry/axe.ts`) on every page at rest: a world's
Modules (with a queued change, View options, Add, a group menu, the launch
review), About (Rename, the next-session editor), Backups, the Library
(Tags, Presets, select mode, a module's Library and Package tabs, Systems,
By world and a world's menu), the server Backups, Configuration, the
Version and power menus, open News, and the Update page (What's new, Your
packages, Release history allowed and not). All pass with no violations.
Dev probes: `scripts/dev/axe-scan.ts`, `focus-walk.ts` (every Tab stop on
each page is visible and shows focus), `menu-keys.ts` (every menu and dialog
opens by keyboard, takes focus, and gives it back on Escape). Fixed on the
way: a button whose name didn't hold its text ("Set a date"), calendar days
named "2026-11-01" (now "Sunday, 1 November 2026"), the grid's group counts
named without their count, an `aria-label` on a plain span, contrast below
4.5:1 (the grid's "companion off" columns, dimmed to 60% whole, now only
their artwork; the count on the chosen segment), no focus ring on Foundry's
plain checkboxes, the release notes' highlights list drawn as loose `dt` and
`dd`, and the Add and By world column menus not moving focus to their first
choice like the others. Kept, with reasons: Foundry's own button hover
colours (3.8:1 for light text on its orange) are its look on every button,
not ours; the axe scan is of the page at rest.

Found on the way, a real bug: Launch pressed right after a change (a switch,
Add, Discard) read the queue before the change had saved, and could launch
without the review. Launch now waits for every queue write and its reload
(at most 10 s), reads the queue as it is, launches once even if pressed
twice (`aria-busy` meanwhile), and launches nothing when the queue can't be
read. Reviews: security none (dev-only dependency, not bundled); code no
critical or high; its four medium findings were this race's other paths
(Add's reload, Discard, Cancel, a failed reload, a second press) and are
fixed with tests.

Package 4 done (`d8e6e19`, fixes in `2d42566`). `shell/layout.css`: the
middle pane keeps Foundry's 1200 px window width on wide screens,
left-aligned beside the rail, header across the screen (the build filled
2560 px); at 1280 px and below the rail is 240 px and the details panel
floats over the page (fixed, 16 px from the edges, above the page's sticky
headers; dropdowns in the page open above it). Measured against the
prototype with `scripts/dev/layout-compare.ts` on the world page, the
Library with a module's details, server Backups and Configuration at 2560,
1366 and 1280: every column box equal. Live: `setup-layout.spec.ts`. Found
on the way: with a side panel at 1366 the selection bar was 708 px in a
610 px pane and put Done under the panel (the prototype overflows the same
way); it now wraps. `scripts/dev/overflow-scan.ts` finds nothing past its
column on any page or tab at 1280 or 1366. Review (code and security in
one, CSS only): no critical or high, no security issue. Fixed: the time-zone
list and the Add menu open above a floating panel; comments; a server-pages
test. Kept as the prototype: at 1280 the floating panel covers the pane's
right edge until closed (Launch included, on a world page with a module's
details open), and opening a panel can re-wrap the selection bar.

Package 5 done (`2d42566`, fixes after it). `scripts/foundry/many.ts` adds
30 test worlds (spread-out last played dates, a few never) and 120 stub
modules to the local server and takes them away (only `ml-many-*` and
`ml-stub-*`). Live: `setup-many.spec.ts` (adds, checks, removes): the rail
scrolls and fades while more worlds are below (`common/scroll-fade.ts`, as
the prototype's `more`); By world keeps 92 px columns, pins module names and
world headers and fades at the right edge while worlds are hidden; Show
narrows to "N of 32 worlds"; a module's details list all 32 worlds and
scroll; the intake offers only a new module's worlds with "Choose from 30
worlds…". Found on the way: the grid's names and headers scrolled away
sideways (Foundry's tables clip, which pinned them to the table; the
prototype sets `overflow: visible`), and long world titles in the grid ran
into each other on one line (an old rule overrode the prototype's two-line
clamp). Review: no critical; fixed the high (the suite could leave its test
data behind if the browser never started) and the mediums (the script
deletes before it logs in, refuses while a world runs, starts clean; the
fade checks before paint, follows the content's size, and a world reached
by keyboard scrolls clear of the fade); a real two-line title test.

Package 6, acceptance (2026-11-07, Foundry 14.370, the full live suite: every
test passes). Every requirement in SETUP-REDESIGN.md was mapped to its
evidence (live test, unit test or code) by a read-through of the specs,
tests and sources. Gaps it found were built first (package 6.6, commits
`1f4ee15`..`1c0383e`): the worlds rail flags a world whose next launch has
problems (with the queued count) and a change made elsewhere that breaks a
world says so; modules that are simply on keep the neutral edge (only
changes and problems are coloured); About shows "Saved" after a save (in a
status region, focus back on the edit link); one live region announces
every world's queue when it changes; "Back up first" is ticked only when no
backup covers the queued changes; no power menu without an admin password;
the Next session editor's quick times come from your own schedules, it shows
players' own times, chosen dates each have their own time in a list, the
Repeats row says the rule, and switching to chosen dates starts from the
rule's next dates; Create a snapshot opens our own dialog as the prototype
(what it holds, Foundry's own space check, a note, the warning), and Foundry
runs it without its dialog. New live checks: `setup-steady.spec.ts`
(nothing moves under the pointer: the banner's first queued change, Select's
bar, the not-saved bar, the backup progress row; a click right after typing
lands; disabled controls explain themselves on a wrapper; neutral edges).

Result by area:

| Area (SETUP-REDESIGN.md)                                                                                                                                      | Result                                                                            | Evidence                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Layout, details panel only when open                                                                                                                          | Met                                                                               | setup-shell, setup-layout                                              |
| Queued changes, review at launch, Back up first                                                                                                               | Met                                                                               | setup-world, apply, world-page and world-tools units                   |
| World cards (switch, name, why line, edges)                                                                                                                   | Met                                                                               | setup-world, setup-steady (edges), world-modules units                 |
| Library cards (star, lock, Update button)                                                                                                                     | Met; the Update button live needs a module with a newer version on foundryvtt.com | setup-library, library-page units                                      |
| Group headers, one style                                                                                                                                      | Met (code shared; not compared by a test)                                         | ModuleSections, Sections, grid rows                                    |
| World banner (star, Locked, pencil, Launch, no menu)                                                                                                          | Met                                                                               | setup-shell, shell units                                               |
| Lock in About › Maintenance                                                                                                                                   | Met (unit)                                                                        | world-about-boxes                                                      |
| Header (chip menu, Backups, Configuration, power menu)                                                                                                        | Met                                                                               | setup-shell, setup-server                                              |
| News and Featured Content                                                                                                                                     | Met                                                                               | setup-news, rail-news units                                            |
| By world, intake, copy a world's set                                                                                                                          | Met                                                                               | setup-library, setup-many, library-grid units                          |
| About edited in place                                                                                                                                         | Met                                                                               | setup-world (title, schedule, description), units                      |
| Next session picker                                                                                                                                           | Met                                                                               | setup-world, session and schedule units                                |
| Backups tab                                                                                                                                                   | Met                                                                               | setup-world, setup-steady, world-backups units                         |
| World without the companion                                                                                                                                   | Met                                                                               | setup-world                                                            |
| Server backups and snapshots                                                                                                                                  | Met                                                                               | setup-server (our dialog, delete), server-backups units                |
| Configuration                                                                                                                                                 | Met; HTTPS certificates need a public domain                                      | setup-server, setup-steady, config units                               |
| Update page                                                                                                                                                   | Met; a real download needs a newer release                                        | setup-server, setup-update-history, update units                       |
| Build requirements (keyboard, focus, live regions, typing, many worlds, order, grid, Show, steady page, wrappers, busy lock, problems flagged, 1366 and 1280) | Met                                                                               | setup-a11y (axe on every page), setup-many, setup-layout, setup-steady |

Not built, for the owner:

1. The companion moving the next session forward from a running world
   (SETUP-REDESIGN.md, "Data", and Open 1b). Setup moves it on when it
   opens. Foundry accepts `editWorld` from a GM in a running world (read in
   14.370's `setup.mjs`), so it can be built in the companion; not done in
   Phase 6.
2. Server sync of the library (`library.json`, PRD D-3): still to decide.
3. Open 2 (mockup gaps, not requirements): no undo for deleting folders,
   tags and presets or for discarding queued changes; the Library's bulk
   "Turn on" works in one world at a time.

Deviations kept, for the owner to confirm:

- The selection bar wraps to a second row when a details panel narrows the
  page (the prototype overflows and hides Done under the panel).
- Foundry's own button hover colours (3.8:1) stay; ours pass 4.5:1.
- Release history asks for the foundryvtt.com permission on the options
  page (a page script can't ask).
- Free disk space and a snapshot's space come from Foundry's internal
  checks behind the `diskFree` flag.

Not verifiable on the local server: a core update download (no build after
14.370 that updates in place exists yet), Let's Encrypt, phones. The rest of
the Update page and the module update are checked live since the follow-up
below.

Package 6.6 reviews: code and security on each part, no critical or high;
no new reach for a page script (Foundry's snapshot dialog was never a
boundary: page scripts can call `game.createSnapshot` themselves). Fixed:
the password flag fails closed (no password is false, not left out), every
world that changes at once is announced, no "now has problems" notice for
the world on screen when no route was chosen yet, "Saved" sits in status
regions that are always there with focus back on the edit link, a removed
chosen date stays removed, the snapshot dialog's Create waits while Foundry
is busy (reason on a wrapper) and warns when the space won't do, and its
space line has a "not known" state.

Follow-up (2026-11-07): the Update page against a real newer release, and a
module update.

- Foundry's update check asks foundryvtt.com once with the installed
  version and gets one release, `latest_release`, back; it doesn't step
  through the builds in between. A release that needs a reinstall still
  comes back as the target, its flags marked (`status: "error"`,
  `requires_full_reinstall`), and Setup's `/update` route hands it to the
  page as it is. So an older build shows everything but the download.
- Run on 14.369 (a copy, with a copy of the data, main server stopped):
  the Version chip says 14.370 is available, its notes read and search,
  Foundry's real compatibility preview lists every package, and the Update
  box says Manual installation required with the download page.
  `setup-update-older.spec.ts` checks this and skips on an up-to-date server;
  the README says how to run it (`FOUNDRY_ALLOW_UPDATE=1` drops
  `--noupdate` in `pnpm foundry:start`).
- `setup-module-update.spec.ts` installs socketlib 1.1.2 from its pinned
  release manifest; Foundry's list offers 1.1.4. The Library card shows
  Update 1.1.4, pressing it runs Foundry's own check and install, and the
  module is removed afterwards.
- Found and fixed: the Version chip's name lacked a space before "update"
  when an update is out, so its text and name didn't match (axe); after a
  module update the card still offered the update (the list is read once
  per Setup load and compared as text, and socketlib's release says
  `v1.1.4` where Foundry's list says `1.1.4`), so it now compares versions;
  and that version read "vv1.1.4", so versions now get one "v" wherever we
  show them.
- Reviews: code and security, no critical or high. Fixed: the module spec
  leaves any socketlib already installed alone and cleans up step by step;
  `FOUNDRY_ALLOW_UPDATE` is taken from the command line only, never
  `.env.local`, and warns; the probe redacts links with a query as well as
  the download link. Kept on purpose: pre-release versions follow Foundry's
  own `isNewerVersion`, as the update list it builds does (a test says so).

Wide screens filled (2026-11-07, the owner's call, replacing package 6.4's
1200 px cap): on a 2560 screen the capped middle pane left a third of the
page empty, even with a module's details open. Now from 1366 px up the rail
and the details panel grow with the screen in their 1366 proportions (290
and 340 px there, `clamp()` in `shell/layout.css`) until 2560 (544 and
637 px), and the middle pane takes the rest; past 2560 only the middle pane
grows. 1366 and 1280 are unchanged. `setup-layout.spec.ts` measures 1280,
1366, 1920, 2560 and 3440 and the server pages at 2560.

Restart after saving Configuration (2026-11-07, the owner's call): Foundry
answers `restart: true` for any saved change (`updateServerConfiguration`),
although some settings apply at once (the Setup theme is read on every page
render). We keep following Foundry's flag rather than our own list of which
settings need a restart, so a finer check in a later Foundry reaches the
page unchanged.
