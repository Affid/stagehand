# Android app: the new Setup page on a phone

Status: planned 2026-11-07; phase 0 closed the same day (answered on the emulator; the phone checks moved to phase 4); phase 1 (phone design): the owner chose the tabs layout and, after the rounds below, moved on to development on 2026-11-08; the owner settled its two open questions on 2026-11-08 (see "Phase 1" below). Phase 2 (app platform layer) done 2026-11-08: the five packages below. Phase 3 (phone layout) started 2026-11-08, split into seven packages below. The owner's decisions are below. Owner's choices: an Android app that
loads the user's Foundry server in a WebView and draws our Setup page over it
(option 2 of three; the others were the extension in Firefox for Android, and
a native client speaking Foundry's protocol); **Setup only** (a world, once
launched, is Foundry's own game screen); **sideloaded APK** for now, Google
Play later.

Design to follow: `docs/SETUP-REDESIGN.md` and `design/setup-page/` for
everything the phone layout doesn't change; the phone layout itself is
designed and approved first (phase 1). Process as `docs/SETUP-BUILD-PLAN.md`:
tests first, `pnpm verify`, live checks, a code review and a security review,
a commit per package, results with screenshots.

## Approach

- **Same UI, new host.** The app injects the extension's Setup scripts into
  the server's pages, as the extension's content scripts do. Foundry keeps
  running underneath: login, its socket, its API calls. One Preact UI serves
  both: the phone layout is a breakpoint in the shared UI, so it also reaches
  the extension on Firefox for Android.
- **A platform layer, chosen at build time.** Today four files call
  `chrome.*`, all behind small interfaces: `KeyValue` (`background/kv.ts`),
  `ScriptingPlatform` (`background/registration.ts`), `ReleasesPlatform`
  (`background/releases.ts`), `RouterDeps` (`background/router.ts`),
  `SettingsPlatform` (`ui/settings/platform.ts`) and `send` in
  `platform/runtime.ts`. The app build implements them over one native bridge.
  No `chrome.*` reaches the app bundle (a test checks the built files).
- **The background runs unchanged in a hidden WebView.** It uses only fetch,
  timers, `crypto.randomUUID` and storage, so it runs in a page on the app's
  own asset origin (`https://appassets.androidplatform.net`, served by
  `WebViewAssetLoader`), never in Foundry's page. The native side carries
  messages between the server WebView and the background WebView.
- **Native code stays thin (Kotlin).** It loads pages, injects scripts,
  checks and relays messages, stores data, fetches the two outside URLs, and
  handles files, dialogs, external links and the back button. No Setup logic
  is written twice.

## How the pieces fit

```
 Home WebView (asset origin)        Server WebView (user's Foundry origin)
 server list, add/remove,           Foundry's /setup, /auth, /join, /game
 Release history access             + injected at document start:
   |                                  app-setup.js (veil + setup-main + setup-ui
   |                                  in one closure, CSS before first paint)
   |                                  app-game.js on /game (game-bridge)
   |                                        |
   |                     addWebMessageListener("mlApp"), origin-pinned
   v                                        v
 ------------------------- Native (Kotlin) --------------------------
 Bridge: size cap, JSON shape, sender = the WebView's current URL
 KeyValue store (app-private)   NativeFetch (2 URLs, rules below)
 Files (Storage Access Framework)   Dialogs   Custom Tabs   Back
 --------------------------------------------------------------------
                                   |
                     Background WebView (asset origin)
                     app-background.js: router, state, commands, relay,
                     library and presets, unchanged
```

## What the app replaces

| Extension today                                                                  | In the app                                                                                                                                                                                                                                            |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dynamic content scripts per server (`scripting.registerContentScripts`)          | `WebViewCompat.addDocumentStartJavaScript` with the server's exact origin; the script checks the server's route prefix and path (`/setup*`, `/game*`)                                                                                                 |
| Isolated world for `setup-ui`                                                    | One main world: `setup-main` and `setup-ui` are one injected closure and talk through a private in-closure channel, not open `postMessage`. This also closes the Phase 5b MEDIUM (a page script forging Setup data that claims `isAdmin`) for the app |
| Content-script CSS before first paint (the veil)                                 | A `<style>` element added by the document-start script; checked in the spike                                                                                                                                                                          |
| `chrome.runtime.sendMessage` and `sender.url` / `sender.id`                      | The bridge object from `addWebMessageListener`, allowed only for saved server origins; the native side attaches the sender (the server WebView's current URL and main-frame flag), never trusting the message                                         |
| `chrome.storage.local`                                                           | Native key-value store in app-private storage, behind `KeyValue`; per-server keys unchanged                                                                                                                                                           |
| Background fetches with host permission (remote config, foundryvtt.com releases) | `NativeFetch`: only `https://foundryvtt.com/releases/...` (when Release history is allowed in the app) and the remote config URL; no redirects, final URL checked, 2 MB cap, 15 s timeout, no cookies, as `releases.ts` today                         |
| Toolbar popup and options page (`SettingsPanel`)                                 | The app's home screen: the same Preact panel on the asset origin, with a `SettingsPlatform` over the bridge (add a server by address, remove, Release history on or off); "Module Library settings" on the rail opens it                              |
| `optional_host_permissions` per server                                           | Adding a server in the app is the consent; only saved origins get scripts and the bridge                                                                                                                                                              |
| Blob download and `<input type=file>` (library export and import)                | A `files` port: the app sends the JSON to native, which saves through the system file picker; import opens the picker (`onShowFileChooser`)                                                                                                           |
| `window.confirm` (folder, tag and preset deletes, import)                        | `WebChromeClient.onJsConfirm` shows a native dialog; the calls stay as they are                                                                                                                                                                       |
| `target="_blank"` links (news, release notes, package pages)                     | External sites open in a Custom Tab; the server's own pages stay in the WebView                                                                                                                                                                       |

## Security

- **Shared world.** Injected scripts share Foundry's page world. Setup runs
  only Foundry's own scripts (packages' scripts load in worlds, not on
  Setup), the same code the extension already trusts with Setup data. The
  bridge accepts only saved server origins and the main frame. The injected
  closure keeps its own reference to the bridge and removes the global name
  if WebView allows it (spike). Every message is validated in the background
  as today (Zod).
- **Hardening.** JavaScript and DOM storage on; file and content access off;
  Safe Browsing on; mixed content never; no `addJavascriptInterface`;
  WebView remote debugging only in debug builds.
- **Plain http.** Foundry on a home network is usually plain http, so
  cleartext is allowed (`networkSecurityConfig`); the server list marks such
  servers "Not encrypted", as Configuration does.
- **Certificate errors** (a self-signed https server) are refused with a
  message in v1 (owner); trusting a certificate the user confirms can come
  later.
- **Data.** App-private storage. Cookies (the admin session) and the library
  are left out of cloud backup and device transfer (`dataExtractionRules`)
  until server sync (PRD D-3) is decided. The release signing key stays
  out of git.
- **Branding.** The app ships none of Foundry's files: its pages, fonts and
  icons come from the user's server, as with the extension. The app's own
  name and icon are ours ("Module Library"), not Foundry's.

## Phases

| #   | Phase                                                  | Scope                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Done when                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | **Tooling and spike**                                  | JDK 21, Android SDK command-line tools, platform tools, Gradle wrapper in WSL (with the owner's go-ahead and SDK licence acceptance); a test device; a throwaway app that loads the local server and proves the risky parts.                                                                                                                                                                                                                                                                                                                | `docs/ANDROID-SPIKE.md` answers every spike question below on a real device. Done on the emulator; the phone part moved to phase 4.                                                                                                                           |
| 1   | **Phone design**                                       | Interactive mockups of the Setup page on a phone in Foundry's look (design kit, header switcher between variants, as for the desktop design); the owner picks; the result added to `design/setup-page/` and `docs/SETUP-REDESIGN.md` (a "Phone" section).                                                                                                                                                                                                                                                                                   | The owner approves the phone layout; it is the spec from then on.                                                                                                                                                                                             |
| 2   | **App platform layer** (TypeScript, no Android needed) | An `app` target in `build.ts` (`app-setup.js`, `app-game.js`, `app-background.js`, `app-home.js`); the platform interfaces over a `NativeBridge` port; the private setup-main/setup-ui channel; `files`, `confirm` and `openExternal` ports used by both builds (the extension keeps its behaviour); a fake bridge for tests; an **app harness**: Playwright with phone emulation that injects the app bundle into the local Foundry and plays the native side in Node.                                                                     | Today's Setup page runs in the harness through the app layer, desktop layout, live tests passing; the extension build unchanged.                                                                                                                              |
| 3   | **Phone layout** (shared UI)                           | The approved design, chosen by orientation and size (portrait: the phone layout at any width; landscape 600 px tall or more: the worlds list on the left): the rail becomes the home list, a world, the Library and each server page full screen with Back, details as a full-screen sheet, header actions in one menu; 48 dp touch targets; hover-only controls shown on touch screens (`hover: none`); explanations that now live only in `title` tooltips get a visible or tap-to-show form; fixed widths released under the breakpoint. | Every page and panel works in portrait at 360, 412 and 768 px wide, on a phone on its side (915×412) and a tablet on its side (1024×768), in the three Setup themes; no By world on the phone; axe clean; desktop layouts unchanged (`setup-layout.spec.ts`). |
| 4   | **Android app** (Kotlin)                               | `packages/android` (Gradle, its own build, `pnpm android:build` runs it after `pnpm build`): home screen, server WebView with injection and bridge, background WebView, key-value store, NativeFetch, files, dialogs, Custom Tabs, Back (Setup's own Back first, then history, then home), cookies kept, certificate errors refused with a message, debug and signed release APKs. Starts with the phone checks left from phase 0: wireless debugging, the firewall rule, Q6 on the phone, a current WebView.                               | The app runs the Setup page on a device against the local server, including a launch that applies queued changes through the companion.                                                                                                                       |
| 5   | **On-device suite and acceptance**                     | Playwright attached to the app's WebView over adb (Playwright's Android support or CDP through `adb forward`), a smoke suite on the device: add a server, Setup takes over, a world, the Library, a queued change, launch and apply, export and import, Release history; screenshots in the three themes; results artifact; the APK copied to a Windows folder for the owner.                                                                                                                                                               | The smoke suite passes on a device; the owner can install the APK.                                                                                                                                                                                            |

Each phase is split into packages in this file when it starts, as in the
build plan.

### Spike questions (phase 0)

1. Are `DOCUMENT_START_SCRIPT` and `WEB_MESSAGE_LISTENER` available on the
   test device's WebView, and from which WebView version? What does the app
   show when they are missing?
2. Does a document-start `<style>` hide Foundry's Setup before the first
   paint (the veil, frame by frame as `setup-veil.spec.ts` checks)?
3. Do Setup's admin login (`/auth`) and its session cookie survive an app
   restart?
4. Does `game-bridge` in the main world at document start still meet the
   companion module's HELLO (5 tries, 1 s apart), so a reviewed launch
   applies its changes?
5. Can the injected closure keep the bridge object and remove its global
   name, so later page scripts can't reach it?
6. Plain http on the local network: the phone reaching the WSL server
   (Windows firewall, mirrored networking), and an emulator through
   `10.0.2.2`.
7. Can Playwright drive the app's WebView from WSL (adb to the device or to
   Windows' adb server)?
8. Font Awesome and Foundry's fonts load from the server in the WebView as on
   desktop.

## Testing

- **TypeScript:** Vitest for the app platform layer (fake bridge) and the
  phone layout (Testing Library), 80% coverage, in `pnpm verify`.
- **Kotlin:** JUnit for everything that decides: message checks, origin
  rules, sender attachment, NativeFetch rules, back-button order, server
  address parsing. Instrumented tests only where a WebView is needed.
- **App harness (fast loop, in WSL):** the real local Foundry, phone
  emulation in Chromium, the app bundle injected as the app does, the native
  side faked in Node. Most live checks of phases 2 and 3 run here, with
  `scripts/dev` screenshots at 360, 412 and 768 px in portrait and on a phone and a tablet on
  their side, in each theme.
- **On device:** the phase 5 smoke suite, not the whole live suite.

## Owner's decisions (2026-11-07)

1. **Test device:** both. An emulator on Windows (Android Studio; WSL has
   no KVM) for day-to-day checks, the owner's phone over wireless debugging
   for the phase 5 smoke suite.
2. **Tooling:** JDK 21 and the Android SDK go into WSL; the owner accepted
   Google's Android SDK licence for the install.
3. **Self-signed https servers:** refused with a message in v1.
4. **App name and icon:** "Module Library", with our own icon (none of
   Foundry's branding).

**Tablets** (decided 2026-11-08, see "Phase 1"): held upright, the phone
layout at any width; on their side, the worlds list on the left.

## What the spike changed (2026-11-07)

From `docs/ANDROID-SPIKE.md`, on the emulator:

- The approach holds: document-start scripts, the origin-pinned bridge
  (its global name can be removed), the veil before the first paint, the
  login cookie across restarts, and Playwright driving the WebView from WSL.
- **A companion bug blocks the launch flow on plain-http network
  addresses**, desktop included (`crypto.randomUUID` exists only in secure
  contexts). Fixed on 2026-11-07, with a live test on a non-localhost
  address (`tests/foundry/companion-http.spec.ts`).
- **WebView version:** Foundry 14 needs Chromium 146. Phase 4 adds a check
  with an "update Android System WebView" message; the emulator needs a
  Google Play image (signed in once) for an up-to-date WebView.
- **Foundry's own pages on a phone:** its "window smaller than 1024×768"
  notice shows on every page (phase 3 handles it on Setup), and `/join`
  hides its Join button at phone width (phase 4 adds a small fix there,
  since a launch can pass through it).

## Phase 1: phone design (2026-11-07)

Mockup in the desktop prototype (`design/setup-page/`): `src/_phone.*`
rearranges the same pages for a phone (`?phone=1`), `phone.html` is the
playground (private artifact https://claude.ai/artifact/R12jn3MMQiXuKMuFnmYCuK),
and `checks/phone.mjs` walks it at 360 and 412 px (no sideways overflow, a
world's tabs on one row, the tabs, Back, sheets, undo in Next launch, the
launch review). Foundry's own page at phone width is the "Foundry today" view
(`scripts/dev/phone-today.ts`).

**The owner chose "tabs"** over "stack" (a worlds list as home with Back and a
⋮ menu) and asked for it to be improved in the mockup. The layout as it
stands (the spec for phase 3; the mockup is the reference where this list is
short):

- A bottom tab bar: Worlds, Library, Backups, Configuration (badges: worlds
  with queued changes, newly installed modules). The version chip and ⏻ sit
  in the top bar on Worlds.
- A world opens over the list with Back. Its picture runs under the top bar,
  which turns solid with the world's name once the banner scrolls away; only
  the Modules, About, Backups row stays pinned.
- A bar at the bottom of a world's page: "N changes · See or undo" opens a
  **Next launch** sheet (each change with undo, Discard all, Launch), and
  Launch opens the review. This replaces the banner's pending line with Review
  and Discard on the phone.
- Details, Tags, Presets and Next launch are bottom sheets (drag down or tap
  outside to close); menus and dialogs open from the bottom.
- Library (decluttered after the owner found it cluttered): one row on top
  (filter, View for Group by, ⋮ for Select, Install, Update all, Tags,
  Presets, New folder, Collapse or expand all, Import and export); new
  installs as one line ("3 new modules to sort", Sort, ×); tags as coloured
  dots on the cards; while selecting, the count, All, None, Done and the
  four actions sit in a bar above the tabs; By world has a 150 px module
  column (three worlds across on a 412 px phone) and its Group by and Show
  in View; the desktop's "Foundry's" card layout is hidden.
- Backups (calmer after the owner's review): the summary and New snapshot
  sit in a bar above the tabs, as Launch on a world, with the tab's count and
  size and the disk space free; one row of tabs with names and counts; the
  explanation shortened to one line beside Select; the filter and Sort by in
  one row; while selecting snapshots, the count, Delete and Done take over
  the bottom bar; dates without the weekday.
- A world running (asked for by the owner): Foundry has no Setup then and
  sends everyone to `/join`, so the app shows its own screen instead: the
  world's picture and name, "Running now", its system, how many people are
  in the game and for how long (all from Foundry's `/api/status`, seen live
  on 14.370: `active`, `world`, `system`, `systemVersion`, `users`,
  `uptime`), and one button, **Return to Setup** (the owner dropped a
  "Join the game" button: the app is for Setup, not the game).
  Return to Setup posts `worldShutdown` to `/setup`; with an admin session
  Foundry needs no password (checked live), without one the sheet asks for
  the admin password as Foundry's `/join` does. With people in the game it
  asks first ("Disconnect and return"); then it waits for the world to close
  and lands on Setup with the world selected. If the world closes elsewhere
  (the GM returns to Setup from inside the game), the app notices by polling
  `/api/status` and shows Setup. No tab bar on this screen: none of the tabs
  work until the world is closed.
- What's new puts the update first; Configuration's Save bar sits above the
  tabs; a world without the companion has one Launch, in the bottom bar.
- Touch sizes 44-48 px; no hover-only controls or tooltips; a phone on its
  side gets a compact banner and an icon-only tab bar; Android's Back steps
  back through dialog, menu, sheet, page (Escape in the mockup).
- A tablet on its side (landscape, 600 px tall or more): the worlds list
  stays on the left and sheets slide in from the right.

The owner's answers to the two open questions (2026-11-08):

1. **A tablet held upright** (768 px and wider in portrait): the phone
   layout. The owner found both fine and chose the worlds list on the left
   for landscape only. So orientation decides, not width: portrait gets the
   phone layout at any width; landscape gets the worlds list on the left
   when the screen is 600 px tall or more, and a phone on its side (412 px
   tall) keeps the phone layout with the compact banner and icon-only tabs.
   (The mockup's rule was 700 px wide and 600 px tall.)
2. **Left off the phone:** the By world grid. Library's View offers Group
   by only, and a library saved on By world opens on the cards. Configuration
   stays: it is part of Foundry's classic settings. Read as: By world is
   left out of the phone layout; a tablet on its side, with the worlds list
   on the left, keeps it (to confirm in phase 3's review).

The approved layout goes into `docs/SETUP-REDESIGN.md` (a "Phone" section).

## Phase 2: app platform layer (started 2026-11-08)

TypeScript only; no Android build. Done when today's Setup page runs in the
app harness through the app layer (desktop layout), the live suites pass on
the app and on the extension, and the extension build is unchanged. The
phone layout (phase 3) and Kotlin (phase 4) are not part of it; the two
open design questions above stayed open during it (settled since).

Packages, each committed on its own after tests first, `pnpm verify`, live
checks, a code review and a security review:

1. **Ports and the private channel** (shared code; the extension behaves as
   today).
   - A `PageChannel` between `setup-main` and `setup-ui`: the window-message
     channel the extension uses today (envelope, source and origin checks)
     and an in-closure pair for the app (copies, delivered asynchronously,
     unreachable from page scripts). `createPageBridge` and `setup-main`
     take a channel; the bodies of `setup-main`, `setup-ui` and
     `game-bridge` move out of `entries/` so both builds start them.
   - `UiPorts` in the UI's context: `files` (save, open), `confirm`
     (asynchronous) and `openExternal` (one delegated handler for our
     `target="_blank"` links). The extension's ports are today's behaviour:
     Blob download, file input, `window.confirm`, the browser opens links.
   - Tests: the channel pair, the ports in import and export, the folder,
     tag and preset deletes, link handling; live: the extension's suite.
2. **NativeBridge and the app platform** (fake bridge).
   - `app/bridge.ts`: the wire format (Zod), requests both ways with ids,
     replies, timeouts, a size cap, unknown requests answered with an
     error. The port is WebView's injected object (`postMessage(string)`,
     `onmessage`).
   - `app/native-api.ts`: the contract phase 4 implements: every request,
     its payload and reply (runtime, key-value, scripts, permissions,
     fetch, files, confirm, external links, home; `route` into the
     background with the sender native attached).
   - Over the bridge: `KeyValue`, `ScriptingPlatform`, `ReleasesPlatform`,
     `RouterDeps` (the app's id, URL and version; settings open the home
     screen), `SettingsPlatform` (no "This site" in the app), runtime
     `send`, the three ports, and the background serving `route`.
   - A fake native side for unit tests; 80% coverage.
3. **The app build target.**
   - `build.ts` builds the app into `dist-app/` (`pnpm build` builds both):
     `app-setup.js` (veil and Setup CSS added as a `<style>` at document
     start, `setup-main` and `setup-ui` in one closure over the private
     channel, the bridge kept and its global name removed, only on the
     server's `/setup`), `app-game.js` (only on `/game`),
     `app-background.js` with `background.html`, `app-home.js` with
     `home.html`. The native side wraps each page script with its server
     (`wrapForServer`), so the scripts know the route prefix.
   - A check in `pnpm verify` that no `chrome.*` or `browser.*` reaches
     `dist-app/`; the extension's `dist/` keeps its files.
4. **The app harness.**
   - `tests/app/`: Chromium with an Android WebView user agent, phone
     emulation (412 px, touch) or a desktop viewport; the asset origin
     served from `dist-app/`; the native side played in Node: key-value
     store, saved origins and scripts, the relay with the sender taken
     from the page's real URL and frame, NativeFetch's rules, files,
     confirm, external links, the home screen. The page scripts and the
     fake bridge are injected at document start for saved origins only, as
     WebView does.
   - Smoke: Setup through the app layer; page scripts can't see the bridge
     or `chrome`.
5. **The live suites on the app.**
   - `tests/foundry/target.ts`: one way for the specs to open Setup as
     admin and to read or seed storage, on the extension or the app
     (`pnpm test:foundry:app`). Extension-only checks (the toolbar panel,
     Chrome's script registration) stay so; the app gets its own for the
     home screen (add and remove a server, Release history).
   - App-only checks: export and import through the files port, deletes
     through confirm, links through openExternal, the veil frame by frame,
     a reviewed launch applied through `app-game.js`.
   - Both suites pass; screenshots and a results artifact.

### Progress

Package 1 done. `page-channel.ts` (`windowChannel`, `localChannelPair`;
the pair copies with `structuredClone`, delivers later, and takes its
globals once when made, so a page script replacing `structuredClone` or
`setTimeout` afterwards can't forge, replay or read messages);
`page/main.ts`, `ui/start.ts`, `bridge/game.ts` hold what the entries did;
`ui/ports.ts` (`browserPorts`, `watchExternalLinks`: only the user's own
clicks, `isTrusted`; a new-tab link that isn't http(s) never opens).
Import and export, and the folder, tag and preset deletes go through the
ports, and a port that fails shows a notice (`actions.guard`). Tests: the
channel, the ports, both halves wired over the private pair, a failing
background, a failing port. Live: the extension's full suite (96 passed,
the 4 older-build checks skipped), then Library, News, Release history and
settings again after the review fixes. Reviews: code and security, no
critical or high. Fixed: the pair's globals (security, medium), synthetic
clicks on our links (security, medium), port failures dropped silently
(code, medium), a Foundry render hook that could throw. Left for the app
packages: native's confirm one dialog at a time (a double click queues
two), native refusing `openExternal` without a tap. Found on the way: a
unit test with a fixed date (a queued change on 2026-11-05 01:00 UTC
against a backup "3 days ago") started failing on 2026-11-08; it now dates
the change a day back.

Package 2 done. `app/bridge.ts` (wire format, requests both ways, timeouts,
an answer for every request even when the result can't be sent, a reply
that doesn't check out ends its request), `app/native-api.ts` and
`app/native-requests.ts` (the contract and its payload limits),
`app/platform.ts` (every platform interface over native),
`app/background.ts` (router deps, `route`, `background.ready`, the home
screen at most once in 2 s), `app/page.ts` (app-setup and app-game: the
bridge taken before anything else; app-game takes it away on the server's
other pages; a bridge whose name can't be removed is refused). The fake
native checks every payload against the contract. No live check yet: the
app has no build until package 3 and no harness until package 4. Reviews:
code (three high: a malformed reply hung its request, an unsendable result
got no answer, native had no way to know the background was ready; all
fixed with tests, and runtime messages no longer time out in the page) and
security (three high: the bridge left on `/join` and other pages, fixed;
scripts registered by the extension's file names, now `{server, ids}`;
hooking of shared built-ins, documented with the rest under "Native rules"
for phase 4).

Package 3 done. `build.ts` builds the extension into `dist/` (the same
entries, order, defines and styles as before; its files unchanged) and the
app into `dist-app/` (`--extension` or `--app` builds one): `app-setup.js`
(the Setup styles put in by a define and added as a `<style>` at document
start; it waits for the root element, which Chromium may not have yet at
document start), `app-game.js`, `app-background.js` with
`background.html`, `app-home.js` with `home.html` (both with a CSP:
own scripts and styles only, no connections, no base or form targets).
`app/bundle-check.ts` fails the build on any `chrome.*` or `browser.*` API
in `dist-app/` (a guard against importing extension code, not against
code written to hide). Reviews: no critical or high for the build.
Left for phase 4: the release APK leaves out the source maps.

Package 4 done. `tests/app/`: `harness.ts` (Chromium with phone emulation,
Pixel 8 in WebView, or a 1600 px desktop; `dist-app/` served on the app's
origin; the bridge object and the page scripts added at document start
only on saved origins, app-setup before app-game; the binding name taken
away after use), `native.ts` (native in Node: storage, saved origins and
scripts, NativeFetch's rule, files, confirm, links, home) and `relay.ts`
(the plan's native rules: the role by page, the sender from the last
committed navigation, the size cap and wire version, payloads checked,
server requests only from a saved server's Setup or game page, replies
only from the background, `route` held until `background.ready` and
again after the background reloads). Live (`app-smoke.spec.ts`): today's
Setup page through the app layer on desktop and phone, an admin-verified
server in native's storage, no bridge for page scripts; on `/join` no
bridge and no server rights, also after `replaceState` to `/setup`; a
forged `route` answer from a Setup page is dropped; another wire version
gets no answer. Reviews: code (three high, all native rules the harness
didn't yet play: the live URL as sender, replies from any page, the size
cap, wire version, odd paths and saved origins) and security (no high;
injection on every origin, replies and roles by URL, the binding left
visible); all fixed as above. Known limits: scripts and origins can be
added but not taken away while running, and Node's answers reach the page
through a global the harness leaves in place.

Package 5 done. `tests/foundry/target.ts`: the live specs open Setup,
read and seed storage, see the settings open and follow outside links
through one `Target`, the extension (default) or the app
(`pnpm test:foundry:app`, `ML_TARGET=app`); every Setup spec and
`apply.spec.ts` moved to it with the same seeded data. Extension-only:
the toolbar panel (`setup-settings.spec.ts`) and `companion-http.spec.ts`
(neither build is involved, run once). App-only: `app-home.spec.ts` (list,
Remove gives Setup back to Foundry, add back, a background that refuses
Setup gives Foundry's page back at once, Release history on and off in
native, no bridge on an unsaved site, the rail opens the home screen) and
`app-ports.spec.ts` (export through native's file picker, import asks
first, a delete waits for native's dialog, an outside link goes to native
and opens no window). The veil (`setup-veil.spec.ts`, every frame of a
Setup load) and a reviewed launch applied through `app-game.js`
(`apply.spec.ts`) pass on the app too. Full runs on 14.370 (after the review fixes): extension 111 passed, 4
skipped (the older-build checks); app 104 passed, 11 skipped (those 4,
the toolbar panel's 6, companion-http).

Found on the way: in the harness the companion's HELLO timed out (1 s,
five tries) because answering into the busy game page with a separate
`page.evaluate` took 1.2 s while Foundry loaded; the harness now answers
through the binding's own reply. The app itself was fine, but the same
1 s window is worth watching on a slow phone (phase 4). Also: when the
background refuses Setup's data, or the data doesn't check out, Foundry's
page now comes back at once instead of after the veil's 15 s (both
builds). Reviews: code and security, no critical or high; fixed a
negative check that could pass too early, a home-screen counter without a
baseline, missing reasons in the rule checks, the sender's fallback to
the live URL (now no rights without a committed navigation), and a host
the app can't grant now fails the suite instead of being ignored.

For phase 4 and the owner:

1. **HELLO window on a phone**: the companion waits 1 s, five times; watch
   it on a slow device.
2. **Home screen text**: "No servers yet. Open your Foundry server in this
   browser and click Use Module Library here" is the extension's; the app
   needs its own words (the home screen is designed in phase 4).
3. **The one-time token** for destructive operations ("Native rules",
   accepted risk): decide in phase 4.
4. **Release APK without source maps.**
5. Playwright keeps traces of failed live tests, which hold the admin
   login request; they stay in `test-results/` (git-ignored), not to be
   shared.

## Phase 3: phone layout (started 2026-11-08)

Shared UI, TypeScript only. Done when every page and panel works in
portrait at 360, 412 and 768 px wide, on a phone on its side (915×412) and
a tablet on its side (1024×768), in the three Setup themes; no By world on
the phone; axe clean; desktop layouts unchanged (`setup-layout.spec.ts`).
The mockup (`design/setup-page/src/_phone.*`) is the spec; it rearranges
the desktop page's markup after each render, which is not a model for the
extension: here the layout is chosen in Preact and each component renders
its phone form.

Which layout (one pure function, `layoutFor`):

- **Touch screen** (`pointer: coarse`: the app, a tablet): portrait gets
  the phone layout at any width; landscape gets the tablet layout (worlds
  list on the left, sheets from the right) when 600 px tall or more, else
  the phone layout (a phone on its side).
- **Mouse** (the extension on a desktop): the phone layout below 700 px
  wide, today's desktop layout from 700 px. Desktop windows from 700 px look
  as they do today; narrower ones, where today's layout doesn't fit, get the
  phone layout.

Android's Back (phase 4) reaches Setup as an Escape key press: an open
dialog or menu closes first (they already stop Escape), then a sheet, then
the page goes back to its list; a press nobody handles is left unhandled
(not `defaultPrevented`), so native knows to go back in history. A page
script can dispatch the same key press, so a synthetic Escape also acts in
a text field (a real key press there stays the field's); the reach is a
step back in our own page, nothing a page script can't already click. For
phase 4, the security review suggests native Back call a function inside
the injected closure instead of dispatching a key press, so synthetic
Escapes in text fields can be ignored.

Packages, each committed on its own after tests first, `pnpm verify`, live
checks in the app harness (phone emulation) and the extension, a code review
and a security review:

1. **Layout and frame.** `layoutFor` and a `useLayout` hook; the phone
   shell: top bar (logo, Foundry VTT, the version chip and ⏻ on Worlds; Back
   and the page's name on a world or What's new), the worlds list as the
   home screen, one page at a time, the bottom tab bar (Worlds, Library,
   Backups, Configuration, with badges for worlds with queued changes and
   new modules), the tablet layout with the worlds list on the left; a dock
   above the tab bar that pages put their bottom bars into; Escape as Back;
   Foundry's "window smaller than 1024×768" notice hidden on Setup; the
   harness's portrait, landscape and tablet devices.
2. **Sheets, menus, dialogs and touch.** The details, Tags, Presets, New
   modules and system panels as bottom sheets (a bar with the name and
   Close, dragged down or tapped outside to close), from the right on a
   tablet; menus and popovers from the bottom; dialogs (launch review,
   snapshot, saving Configuration) full width from the bottom; notices under
   the top bar; 44-48 px touch targets; controls a desktop shows on hover
   always shown (`hover: none`); explanations that live only in `title`
   tooltips get a tap-to-show form.
3. **A world's page.** The picture under the top bar, which turns solid
   with the name once the banner scrolls away; only the tab row stays
   pinned; the bottom bar ("N changes · See or undo" and Launch) and its
   **Next launch** sheet (each change with undo, Discard all, Launch);
   "11 → 14" in the tab row; About, the next session and Backups in one
   column; the compact banner on a phone on its side.
4. **Library.** One row (filter, View for Group by, ⋮ for Select, Install,
   Update all, Tags, Presets, New folder, Collapse or expand all, Import
   and export); new installs as one line; tags as coloured dots; while
   selecting, the count, All, None, Done and the four actions in the dock;
   no By world on the phone (a library left on By world opens on the
   cards; the tablet layout keeps it); no "Foundry's" card layout; the Sort
   sheet with labels above their controls.
5. **Server pages.** Backups: the summary and New snapshot in the dock, one
   row of tabs with counts, the note in one line, filter and Sort by in one
   row, rows with the name on top, selecting snapshots in the dock, dates
   without the weekday. Configuration in one column with its Save bar in
   the dock. What's new with the update first, in one column.
6. **A world running (the app).** The app opened while a world runs:
   Foundry sends everyone to `/join`, so the app shows its own screen there
   (the world's picture and name, "Running now", its system, people and
   uptime from `/api/status`, and **Return to Setup**, which asks for the
   admin password only without an admin session and asks first with people
   in the game), and goes to Setup when the world closes. Right after a
   launch from the app, `/join` stays Foundry's, so the GM can join and the
   companion applies the changes.
7. **Acceptance.** A walk of every page and panel at the five sizes in the
   three themes (no sideways overflow, touch sizes, axe), the desktop
   layout specs, screenshots, the "Phone" section of
   `docs/SETUP-REDESIGN.md`, the results artifact.

### Phase 3 progress

1. **Layout and frame** (done 2026-11-08). `ui/shell/phone/`: `layout.ts`
   (`layoutFor`, the hook; the layout holds while a text field has focus,
   so Android's keyboard can't turn a tablet into a phone), `nav.ts` (home,
   the trail Back retraces, the tabs; pure), `PhoneShell.tsx`,
   `PhoneTop.tsx`, `TabBar.tsx`, `Dock.tsx` (Preact core's `createPortal`:
   importing `preact/compat` turned every `onBlur` in the page into
   `focusout` and broke the session editor's time fields), `phone.css`.
   Foundry's window-size notice: the UI sends `COMPACT`, the page world
   removes the notification whose text is Foundry's formatted
   `resolutionTooLow` issue, now and after each resize
   (`page/resolution.ts`). Popups mark Escape handled, and the details
   popover now takes it in the capture phase (review: it ran after Back).
   Live: `app-phone-frame.spec.ts` in the app harness (Pixel 8, a tablet
   upright and on its side, a phone on its side); `scripts/dev/phone-shots.ts`
   takes screenshots at the five sizes.
2. **Sheets, menus, dialogs and touch** (done 2026-11-08).
   `phone/Sheet.tsx` (the panels as bottom sheets dragged down by their top,
   from the right on a tablet; the page behind inert; focus in and back),
   `phone/popups.ts` (menus from the bottom over a scrim of ours, which
   outlives the menu by 400 ms so the closing tap's click can't land on the
   control underneath, from the security review; a menu inside a sheet gets
   the sheet's own scrim), `phone/TouchTip.tsx` (a tap on something that
   only explains, or a long press on a control, shows its `title`; Chrome's
   touch adjustment moves a finger to the nearest control, so the explained
   icon under the finger is found by geometry), dialogs from the bottom,
   notices under the top bar, 40 × 24 switches. Live:
   `app-phone-sheets.spec.ts`. Left as review notes: a page script can add
   a fake menu and leave the scrim up (no escalation: it shares the DOM);
   the sheet repeats its panel's name; the By world grid's column menus
   rise above the scrim by CSS but couldn't be opened live (the test worlds
   don't run the companion).
3. **A world's page** (done 2026-11-08). `world/LaunchBar.tsx` (the
   bottom bar in the dock), `world/NextLaunch.tsx` (the sheet, through a
   sheet host beside the pages, since the page behind a sheet is inert;
   each change's undo reuses the launch review's list), the banner under a
   top bar that turns solid once it scrolls away, the tools out of the
   pinned tab row, "11 → 14" (said as "11 now, 14 after launch"), one
   column, a compact banner on a phone on its side; `phone.css` split in
   three (frame, sheets, world). From the reviews: one launch rule
   (`launchOff`) for the banner, the bar and the sheet, and checked again
   inside the launch itself; a Next launch sheet closes when its world isn't
   the one shown. Live: `app-phone-world.spec.ts` on the test world after a
   GM launch (joined at pixel ratio 1: the game drawn without a GPU at the
   phone's 2.625 couldn't answer the companion's hello in time). For the
   owner: Discard all sits beside Launch with no confirmation, as in the
   mockup and on the desktop.
4. **Library** (done 2026-11-08). `library/head/PhoneHead.tsx` (one row:
   the filter, View for Group by, ⋮ for the rest; Systems: the filter,
   Install and Update all as icons), the one-line notice for new installs,
   the selection in the dock, no By world on a phone (`shownTab`; a tablet
   keeps it), tag dots and the Sort sheet's labels above their controls in
   `phone-library.css`. Live: `app-phone-library.spec.ts`. Reviews: no
   finding above low.
5. **Server pages** (done 2026-11-08). Backups without its head on a
   phone (a snapshot under way shows there instead), the summary and New
   snapshot in a bar in the dock, one row of tabs with counts only, the note
   in one line, dates without the weekday, selecting snapshots in the dock;
   Configuration's unsaved bar in the dock; What's new with the update first
   (`phone-server.css`). Live: `app-phone-server.spec.ts`. Reviews: no
   finding above medium (a misspelt class, fixed).
6. **A world running** (done 2026-11-08). `app/running/`: on the server's
   `/join`, unless it came from our `/setup` (a launch), the app shows its
   screen over Foundry's join page (inert under it): the world's picture
   and name, Running now, the system, people and uptime from `/api/status`,
   and Return to Setup, which asks first with people in the game. Checked
   live on 14.370: an admin session made on Setup before the launch closes
   the world with no password; without one, Foundry wants the admin
   password (it answers with `/join` again), so the screen asks for it then.
   Polls the status, goes to Setup once the world has closed (or 30 s after
   Foundry confirmed the close). Live: `app-phone-running.spec.ts`.
   Differences from the mockup, for the owner: no ⏻ menu on this screen
   (Log out and Shut down need Setup's actions, which don't exist while a
   world runs), the version chip has no menu, and the system shows by its id
   ("dnd5e 6.0.6": the join page has no system title). A GM who leaves the
   game for `/join` also sees this screen rather than Foundry's join form
   (the app is for Setup).

## Native rules (for phase 4)

The contract is `packages/extension/src/app/native-api.ts` (who may ask
what), `native-requests.ts` (payloads and limits) and `bridge.ts` (wire
format). Besides those, native must (package 2 security review):

- **Know the caller by WebView**, never by message: three WebView
  instances (server, home, background), each with its own request list.
  Home and background load only the app's own pages, block navigation and
  have a CSP (`script-src 'self'`).
- **Attach the sender** from the server WebView's last committed
  navigation (`onPageStarted`), not `getUrl()` at arrival: a page can
  `history.replaceState` from `/game` to `/setup` without navigating.
  Accept only `isMainFrame` messages whose `sourceOrigin` equals that URL's
  origin. Turn off multiple windows. Build the `route` payload with a JSON
  library (`{message, sender}`), never by splicing the page's text.
- **Server requests only from a saved server's `/setup*` or `/game*`**,
  compared after normalising; refuse sender paths with `%`, `\`, `..`,
  control characters or `//`. Never save the app's own origin or
  foundryvtt.com as a server.
- **Scripts:** `scripts.register` carries `{server, ids}`; inject only the
  app's own `app-setup.js` then `app-game.js` (that order: app-game takes
  the bridge away on the server's other pages), wrapped with
  `wrapForServer` using a JSON encoder and the stored server, and only for
  a saved origin.
- **openExternal:** parse with `Uri`; http or https, a host, no user
  info, at most 4096 characters, not the server's own origin; at most one
  a second. A message carries no tap, so a page script on Setup could
  still ask: native shows the host before opening, or keeps the limit.
- **Dialogs and pickers:** one at a time (a second confirm while one is
  open is a no), plain text, the app's and the server's name in the title.
- **NativeFetch:** `fetchAllowed` with native's own Release history state
  (Java: match the whole string, `\z`, not `$`), no redirects, no cookies
  or Referer, 2xx only, stop reading past the cap.
- **Accepted risk, for the owner:** our scripts share Foundry's page world,
  so a hostile server (or anyone on a plain-http path to it) can hook
  JavaScript built-ins and forge what our closure sends or reads, a
  confirm's yes included. That reaches only that server's library in the
  app, as in the extension. A native one-time token for destructive
  operations (delete, import), checked by the background, would close it;
  decided in phase 4.

## Risks

- **Old WebViews.** The two WebView features need an up-to-date Android
  System WebView; without them the app says so and offers Foundry's own page.
- **Foundry's own pages on a phone.** `/auth`, `/join` and the game screen
  stay Foundry's desktop pages; the game screen is out of scope.
- **Two builds of one UI.** The platform layer and a test that the app bundle
  holds no `chrome.*` keep them apart; the live suites run on both.
- **Unknown Foundry versions.** Safe mode and a failed mount leave Foundry's
  page alone, as in the extension.
