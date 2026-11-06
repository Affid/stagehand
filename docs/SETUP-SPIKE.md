# Spike: our own Setup page over Foundry V14 (build 369)

Date: 2026-11-05. Live server on port 30000, Playwright Chromium, admin session.
Foundry's layout hidden with CSS only (`#setup, #setup-menu, #main-header,
#watermark { display: none }`); Foundry's apps stay alive and rendered.
Scripts: `design/setup-page/spikes/` (`setup-shell-spike.ts`, `setup-shell-spike2.ts`,
`spike-about.ts`, `spike-edit.ts`); run them from the repo root with the server up.
They write screenshots to `design/setup-page/out/shots/`. `spike-edit.ts` changes the
test world's next session and restores it; the others only read and open dialogs.

## Source: what drives Setup

- `ui.setupPackages` (`SetupPackages`, AppV2, frameless). Buttons go through
  `_onClickAction(event, button)`, a `switch` on `data-action`:
  `installPackage` → `game.browsePackages(type)`, `moduleCreate` →
  `new ModuleConfig()`, `updateAll` → `#updateAll`, `updatePackage` →
  `#updatePackage`, `viewMode`, `worldCreate` → `#createWorld` (navigates to
  `/create`), `worldLaunch` → `#launchWorld`, `tour`.
- Card right-click: Foundry `ContextMenu`, items built by private
  `#setContextMenuItems(li)`: Launch, World/Module config, Favourite
  (`#toggleFavorite`, setting `core.setupPackageFavorites`), Lock
  (`#toggleLock` → `game.post({action: "lockPackage"})`), Delete
  (`game.uninstallPackage`), Take backup (`game.createBackup`), Restore latest
  (`game.restoreLatestBackup`), Manage backups (`new BackupList`).
- `ui.setupMenu` (`SetupMenu`) actions: `viewWarnings` (`SetupWarnings`),
  `configure` (`ServerSettingsConfig`), `update` (navigates to `/update`),
  `backups` (`BackupManager`), `adminLogout` (`game.post adminLogout`),
  `shutDown`.
- `game` is `Setup` with public, JSDoc'd methods: `browsePackages`,
  `installPackage`, `uninstallPackage`, `checkPackage`, `warmPackages`,
  `getPackages`, `checkDependencies`, `installDependencies`, `createBackup`,
  `restoreLatestBackup`, `deleteBackups`, `listBackups`, `createSnapshot`,
  `previewCompatibility`, `post`, `reload`.
- Only `WorldConfig` is exposed as a class
  (`foundry.applications.sidebar.apps.WorldConfig`). `InstallPackage`,
  `BackupManager`, `BackupList`, `ServerSettingsConfig`, `SetupWarnings`,
  `SetupUpdate` are module-private: reach them through `game.*` methods or
  Foundry's own (hidden) buttons and menus.

## Results

| Capability                                          | Result                                                                                                                                                                                 | How we'd call it                                                                                                              | API kind                                                                            |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Re-render while hidden                              | Works. `render()` fires `renderSetupPackages`, list stays hidden                                                                                                                       | `ui.setupPackages.render()`, `Hooks.on("renderSetupPackages")`                                                                | Public                                                                              |
| Install dialog + package browser (modules, systems) | Works. Opens centred over our page, registry loads (4280 packages)                                                                                                                     | `game.browsePackages("module" \| "system", {search})`                                                                         | Public                                                                              |
| Dry update check (one package)                      | Works (`dnd5e`: remote 6.0.6, isUpgrade, manifest)                                                                                                                                     | `game.checkPackage({type, id})`                                                                                               | Public                                                                              |
| Update one / Update all                             | Works with caveat (not run: both install immediately, no confirm). Need Foundry's hidden buttons to exist: they disable/spin `[data-action]` buttons inside `ui.setupPackages.element` | `.click()` on hidden `[data-action="updatePackage"]` / `updateAll`; or our own loop over `checkPackage` + `installPackage`    | Private `#updateAll`/`#updatePackage`, reachable via DOM; or public building blocks |
| Edit world                                          | Works                                                                                                                                                                                  | `new foundry.applications.sidebar.apps.WorldConfig({world}).render({force:true})`                                             | Public class                                                                        |
| Create world                                        | Works with caveat: Foundry's flow is a separate page (`/create`, 200)                                                                                                                  | Navigate to `getRoute("/create")`                                                                                             | Route                                                                               |
| Launch world                                        | Works: clicking the hidden card's play button reached `/join`; shut down again                                                                                                         | `.click()` on hidden `li.world [data-action="worldLaunch"]` (private `#launchWorld` also handles migration prompt and backup) | Private, via DOM                                                                    |
| Right-click menu on hidden cards                    | Works. Menu renders at the event coordinates over our page, all items present (async: wait a frame)                                                                                    | `dispatchEvent(new MouseEvent("contextmenu", {clientX, clientY}))` on hidden `li.package`                                     | Foundry markup                                                                      |
| Favourite / lock                                    | Works through that menu (toggled and restored)                                                                                                                                         | Menu item click; lock also `game.post({action:"lockPackage", type, id, shouldLock})`                                          | Private / POST                                                                      |
| Uninstall                                           | Works: Foundry's own confirm dialog shows; dismissed, nothing removed                                                                                                                  | `game.uninstallPackage(pkg)`                                                                                                  | Public                                                                              |
| Take backup                                         | Works: Foundry's dialog; cancelled                                                                                                                                                     | `game.createBackup(pkg, {dialog: true})`                                                                                      | Public                                                                              |
| Backup manager / Manage backups                     | Works                                                                                                                                                                                  | `.click()` on hidden `#setup-menu [data-action="backups"]`; per package via card menu                                         | Private class, via DOM                                                              |
| Configuration, warnings                             | Works                                                                                                                                                                                  | `.click()` on hidden `#setup-menu [data-action="configure" \| "viewWarnings"]`                                                | Private class, via DOM                                                              |
| Core update, logout, shutdown                       | Not run. Update navigates to `/update`; logout is `game.post({action:"adminLogout"})`                                                                                                  | Route / hidden button                                                                                                         | Route / POST                                                                        |
| Notifications                                       | Works over our page                                                                                                                                                                    | `ui.notifications.*`                                                                                                          | Public                                                                              |
| Tours                                               | Works with caveat: steps without a target show; steps that point at Setup elements will point at hidden ones                                                                           | `game.tours.get(id).start()`                                                                                                  | Public                                                                              |
| Progress bars (install, update, backup)             | Caveat: Foundry draws them in `#progress` inside the hidden tab, so they're invisible                                                                                                  | Wrap public `ui.setupPackages.onProgress(data)` and draw our own, or move `#progress`                                         | Public method                                                                       |
| Busy lock during backups                            | Caveat: `ui.setupPackages.toggleLock()` disables Foundry's (hidden) controls only                                                                                                      | Mirror it on our page by wrapping `toggleLock`                                                                                | Public method                                                                       |

## Risks

1. **Private handlers behind `data-action`.** Launch, update one, update all,
   favourite, lock, backup manager and configuration have no public API: we
   reach them by clicking Foundry's hidden buttons or its card menu. That ties
   us to a small set of Foundry markup (`data-action` names, `li.package
[data-package-id]`, `#setup-menu`). It's far less than today's decoration
   of the whole list, but it must sit behind the remote-config selectors and
   be smoke-tested on every Foundry build.
2. **Things Foundry shows inside its own layout** (progress bars, the busy
   lock, tour targets, the world-launch spinner) become invisible. We must
   wrap `onProgress` / `toggleLock` and show our own; tours need our page to
   keep Foundry's ids or the tours stay off.
3. **Update actions install without asking.** If we offer Update and Update
   all, they act immediately (as in Foundry). A confirm step would be ours.
4. **Create world and core update are separate Foundry pages** (`/create`,
   `/update`). The extension only runs on `/setup*` today, so those pages stay
   Foundry's unless we add them.
5. **Stability.** Public `game.*` Setup methods have existed since V11 with
   the same names, so they're the safest base. The private flows and the
   unexported classes are internal and can change in any major version; the
   fallback (show Foundry's page again) covers that. Not checked on V13.
6. **Server state touched by the spike:** none left changed. ml-fixture-b was
   locked and unlocked again; favourites are empty as before; the test world
   was launched and shut down; no backup was taken.

## Follow-up 2026-11-06 (build 370): a world's About and Backups

Read from `public/scripts/foundry.mjs` and `dist/packages/package-backups.mjs`, plus a
read-only live check (`spike-about.ts`: opened windows and menus, confirmed nothing).

- World data on Setup has `coreVersion`, `systemVersion`, `compatibility`, `lastPlayed`,
  `playtime`, `nextSession`, `background`, `description`, `joinTheme`, `safeMode`,
  `resetKeys`. No users/player count, no size on disk, no created date.
- World card menu (V14): Launch, World Configuration, Favourite, Lock, Delete, Take Backup,
  Restore Latest (only when backups exist), Manage Backups. No separate reset or migrate.
- `WorldConfig` fields: title, id, system, background, joinTheme, nextSession,
  resetKeys ("Reset User Passwords"), safeMode, description. One window for all of them.
- Migration has no separate action: `#launchWorld` → `#displayWorldMigrationInfo` asks
  at launch and offers a backup.
- Backups: `game.listBackups()` → `{world: {id: BackupData[]}, …, snapshots}`, newest
  first. BackupData: id, packageId, type, createdAt, size, originalSize, note, title,
  description, version, compatibility, relationships, system, snapshotId. Foundry's own
  list labels each by date, shows the note as a hint, size and a compatibility badge.
- Per-backup actions are public: `game.restoreBackup(backupData, {dialog: true})`
  (confirm-code dialog, offers a backup first) and `game.deleteBackups(pkg, ids,
{dialog: true})`. Backups that belong to a snapshot can't be deleted alone.
- The live server had no backups, so the restore and delete dialogs weren't opened.

## Follow-up 2026-11-06: editing a world without WorldConfig

- WorldConfig saves with `POST /setup {action: "editWorld", id, ...changes}` after
  `world.validate({changes, clean: true})`; the server's `World.update` calls
  `updateSource(changes)` (a partial merge), saves `world.json` and returns the world.
- Live test (`spike-edit.ts`) on module-library-test: `game.post({action: "editWorld", id,
nextSession})` saved one field, `world.json` kept every other field; an empty title was
  rejected by `validate` before sending; the value was restored to null and checked on disk.
- `foundry.applications.elements.HTMLProseMirrorElement.create(...)` renders on Setup, and
  `FilePicker` renders (6 entries), so description and background can use Foundry's own controls.
- Risk: "editWorld" is an internal request name (stable, but not a documented API). Put it
  behind the remote config and the build smoke test; fall back to opening WorldConfig.
- resetKeys and safeMode are one-shot flags on the same request: resetKeys clears passwords
  on save (needs our own confirm), safeMode applies to the next launch.

## Follow-up 2026-11-06 (build 370): snapshot and backup dialogs, live

`design/setup-page/spikes/spike-snapshot.ts` created one snapshot through Foundry's own
dialog, opened the restore dialogs and cancelled them, then deleted the snapshot through
Foundry's confirm-code dialog. The server ended as it started (no backups; module symlinks
untouched). No restore was confirmed.

- Create dialog (`game.createSnapshot({dialog: true})`): package counts per type (2 worlds,
  19 modules, 1 system, not names), "178 MB required / 995 GB available", optional note,
  the can't-be-interrupted warning. Foundry locks Setup while it asks and while it runs.
- It took 7.3 s for 178 MB of packages; the snapshot held 22 backups and was 131 MB
  ("required" is the uncompressed size).
- Order: modules, then systems, then worlds (`createSnapshot:snapshotModules`,
  `snapshotSystems`, `snapshotWorlds`), each package as `createBackup:archive` with its
  title and percentage, then `createSnapshot:complete`.
- **Progress reaches our page:** `game.socket.on("progress", …)` on the Setup page received
  all 345 messages. Foundry draws them in its own (hidden) layout as "Snapshotting Modules
  47%" and "Backup In Progress <package> 1%", so our page must draw them itself.
- Restore snapshot (`game.restoreSnapshot(data, {dialog: true})`): "All versions and world
  states will be rolled back. This process cannot be undone.", disk space, typed code.
- Restore one backup (`game.restoreBackup(data, {dialog: true})`): warning, "Back Up Current
  State" checkbox (ticked from the `core.backupBeforeRestore` setting), typed code.
- Delete snapshot (`game.deleteSnapshots([id], {dialog: true})`): typed code; deletes the
  snapshot and every backup in it.
- Snapshot data: `id, note, generation, build, size, originalSize, createdAt, backups`.
