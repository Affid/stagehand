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

### Phase 1: shell (in progress)

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

Next:

3. Setting: per-server "new Setup page" flag in the background state (`messages.ts`,
   `background/state.ts`, router), a switch on the options page and in the current UI.
4. `ui/shell/`: `ShellRoot` (full-page host), `Header` (logo, version chip, Backups,
   Configuration, ⏻ menu, "Foundry's Setup page"), `WorldRail` (worldOrder, filter, flags
   from `worldRow`), router state in the store (`page: world | library`, `worldId`).
5. Library route renders today's `ModulesRoot`; world route renders a banner plus today's
   world sheet content (`WorldSheet`).
6. Mount in `entries/setup-ui.tsx` when the flag is on and the adapter allows changes;
   on any mount error send `SHELL` off and keep today's UI.
7. Live test in `tests/foundry/`: turn on, open a world, open the Library, switch back.
