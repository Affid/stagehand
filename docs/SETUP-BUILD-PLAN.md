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
| 6   | **News and finish** | News and Featured Content at the foot of the rail, read state; accessibility pass; 1280 and 1366 layouts; many worlds; make the new page the default.                                                                                                                                                                                                                                                                                                                  | Acceptance: every requirement in SETUP-REDESIGN.md checked on Foundry 14.                                                      |

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

### Phase 5b: prototype parity (in progress)

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

Then package 7 (server pages) and Phase 6 (News and finish).
