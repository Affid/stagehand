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
- **Opt-in until parity, always reversible.** A per-server setting turns the new page on.
  "Foundry's Setup page" in our header turns it off. Any error while mounting restores
  Foundry's page and keeps the current Module Library UI. Safe mode (unknown Foundry
  generation) never takes over the page.
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

Next: Phase 6 (News and finish).
