# M0 spike findings

Date: 2026-11-05. Foundry V14 Stable, build 369 (Node build, local, WSL2).
Browser: Playwright's Chromium 1248 with the unpacked extension.

The whole loop works end to end on V14 (`pnpm test:foundry`, 6 tests):
register a server, inject into Setup, read package data, verify the admin,
queue a command from Setup, relay it to the companion module on the game
page, confirm in-world, apply, reload, and acknowledge in two phases.

V13 and Firefox are not verified yet (see "Still open").

## 1. Setup page (V14)

- `game` is a `Setup` instance (`game.view === "setup"`).
- `game.modules`, `game.worlds` and `game.systems` are `Collection`s of
  `Module`, `World` and `System` objects with the full manifest data:
  `authors`, `relationships` (`requires`, `recommends`, `conflicts`,
  `systems`), `compatibility`, `library`, `packs`, `esmodules`, `version`.
  Worlds carry `system`, `systemVersion`, `coreVersion` and `lastPlayed`.
- `game.release` gives `generation` and `build`, which is what version
  detection needs (V-1).
- `game.data.isAdmin` is `true` on an authenticated Setup page. That's the
  admin-verification signal (PR-1).
- `game.data` also holds `options`, `certificate` and `licenseInvalid`. The
  extension never reads them (8.6).
- Without an admin session, `/setup` redirects to `/auth`. While a world is
  running, it redirects to `/join`.
- The UI is ApplicationV2: `ui.setupPackages` is a `SetupPackages`
  (`HandlebarsApplication`), id `setup-packages`, with a `primary` tab group
  (`worlds`, `systems`, `modules`). There are also `ui.setupMenu` and
  `ui.setupSidebar`.
- `Hooks.on("renderSetupPackages")` fires on every re-render. The extension
  remounts there, and the spike test re-renders to check it.
- Markup: `#setup-packages-worlds`, `#setup-packages-modules`,
  `#modules-list > li.package.module[data-package-id]`,
  `#worlds-list`, `#module-filter`.
- `foundry.utils` and `Hooks` are available on Setup. No add-on module code
  runs there, so only core code shares the page with the extension.

## 2. Extension architecture

- **Content scripts can't see `game`** (they run in an isolated world). The
  Setup adapter therefore has two scripts:
  `setup-main.js` (`world: "MAIN"`) reads `game` and posts plain data with
  `window.postMessage`; `setup-ui.js` (isolated) validates the envelope,
  reports to the background and renders with `textContent` only.
  The PRD (sections 6 and 7.1) should say this.
- **Dynamic registration works in Chrome** with
  `scripting.registerContentScripts` (`persistAcrossSessions: true`),
  including the MAIN world and match patterns with a port
  (`http://localhost:30000/setup*`).
- Permission requests need a user click, so they happen on the options
  page. The background only checks `permissions.contains` before
  registering. The test build pre-grants `http://localhost/*`, because
  Chrome's permission prompt is native UI that Playwright can't click.
- The background works out which server a message comes from using
  `sender.url`, never a field in the message. It then routes by path
  (`/setup` or `/game`). Global writes (queueing) need an admin-verified
  server.
- The background is built as IIFE classic scripts, so the same file can run
  as Chrome's service worker and as Firefox's background script.

## 3. Bridge and companion module

- The bridge runs at `document_start` and listens straight away. The
  module's `HELLO` retries (5 x 1 s) cover the race with the bridge asking
  the background whether it's enabled.
- If the server isn't admin-verified, the bridge never answers, so the
  module stays idle (PR-7).
- Role check: `game.user.role === CONST.USER_ROLES.GAMEMASTER` (4).
  Assistant GMs (3) get nothing. Tested.
- Apply: `game.settings.set("core", "moduleConfiguration", map)`, then
  `foundry.utils.debouncedReload()`. After the reload, the snapshot matches
  the target and the extension marks the command `applied`. Tested.
- `relationships.requires` on a live `Module` is iterable (a Set), not an
  array. Spread it.

## 4. Server endpoints used by the test scripts

- `POST /auth` `{action: "adminAuth", adminPassword}` (form).
- `POST /setup` `{action: "launchWorld", world}`,
  `{action: "worldShutdown", adminPassword}`.
- `POST /create` `{action: "createWorld", id, title, system}`.
- POSTs need a same-origin `Origin` header (Foundry's CSRF check).

## 5. Test-environment notes

- A fresh browser profile gets Foundry's first-run Setup tour
  (`core.backupsOverview`). Its overlay blocks clicks, so the tests close it
  with `foundry.nue.Tour.activeTour.exit()`.
- Pages in one browser context share Foundry's session cookie, and a user
  who is still connected can't be chosen on `/join`. The tests switch users
  on a single page.
- Headless Chromium has no GPU, so Foundry shows its hardware acceleration
  warning. It's harmless here.

## 6. Adapter interface (from what V14 needed)

```ts
interface SetupAdapter {
  /** e.g. { generation: 14, minBuild: 0 } */
  readonly range: VersionRange;
  /** Main world: is this a Setup page this adapter understands? */
  detect(page: PageGlobals): boolean;
  /** Main world: package and world data, never options or licence. */
  read(page: PageGlobals): SetupData;
  /** Main world: call back after Setup re-renders. */
  onRerender(page: PageGlobals, fn: () => void): void;
  /** Isolated world: where the organisation UI goes, per tab. */
  mountPoint(doc: Document, tab: "worlds" | "modules"): Element | null;
}
```

## 7. To fix in M1

- The apply dialog lists a dependency both under "Enable" and under
  "Added as dependencies". Show it once.
- The background's storage writes are read-modify-write. Serialise them
  (one queue per key) before more than one tab can write.
- Queueing in the spike takes module ids. M1 queues presets (P-3) and
  checks conflicts, compatibility and systems (8.5 steps 5-7).

## Still open

- **V13**: not installed locally. It needs the V13 Node build on a second
  port with its own data folder (`FOUNDRY_APP_DIR`, `FOUNDRY_DATA_DIR`,
  `FOUNDRY_PORT`).
- **Firefox**: MAIN-world dynamic content scripts (Firefox 128+), match
  patterns with ports, and the background `scripts` key are not tested.
  `web-ext` is the tool for that.
- Store accounts (M0 task for the owner).
