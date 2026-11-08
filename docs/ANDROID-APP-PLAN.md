# Android app: the new Setup page on a phone

Status: planned 2026-11-07; phase 0 closed the same day (answered on the emulator; the phone checks moved to phase 4); phase 1 (phone design): the owner chose the tabs layout and, after the rounds below, moved on to development on 2026-11-08; the owner settled its two open questions on 2026-11-08 (see "Phase 1" below). Phase 2 (app platform layer) done 2026-11-08: the five packages below. Phase 3 (phone layout) done 2026-11-08 in seven packages. Phase 4 (the Android app) done 2026-11-08 in five packages: the app runs the Setup page on the emulator, and a launch from it applies queued changes through the companion. Phase 5 (on-device suite) done 2026-11-09: `pnpm test:android` passes on the emulator and the release APK is in the owner's folder; the run on the owner's phone waits for its checks. The owner's decisions are below. Owner's choices: an Android app that
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
   accepted risk): skipped for v1, by the owner on 2026-11-08.
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
7. **The walk, and the owner in the emulator** (done 2026-11-08).
   `tests/foundry/app-phone-walk.spec.ts` visits every page and panel at
   360, 412 and 768 px upright and on a phone and a tablet on their side,
   in Foundry's three Setup themes: nothing goes sideways, the bars'
   controls are 44 px, axe finds nothing (`settle.ts` waits for the page to
   stop moving first). It found the About folder path overflowing at 360 px,
   the version chip's 32 px target, a world's Take a backup running off
   the screen (the calmer Backups row now covers a world's tab, as in the
   mockup) and Launch at 40 px on a phone on its side (44 px now, in the
   mockup too: a change for the owner to confirm). The full run's two
   failures that passed alone were the tests: a button renamed in package
   5, and a GM joining from a blank page, which the running-world screen
   (package 6) now covers; joins come from Setup, as after a launch. The owner tried the page in the
   Android emulator through a preview of the spike app
   (`spikes/android/preview/`: the app bundle with native played inside
   the page; dev only, the built `preview.js` is git-ignored) and found
   two more: the world's Launch bar showing on the home screen (the dock
   is hidden there now) and a snapshot under way running off the screen,
   in the mockup too (one column on a phone now, in both;
   `app-phone-server.spec.ts` plays Foundry's progress through its own
   handler at 360 and 412 px). Unexplained, left as a note: two progress
   ticks sent in one task in the live page lose the later one; Foundry
   sends each in its own socket message, and the real snapshot in the
   emulator showed them all.

## Phase 4: the Android app (started 2026-11-08)

Kotlin in `packages/android`, its own Gradle build (AGP 9.4.1 with its
built-in Kotlin, as the spike). Done when the app runs the Setup page on a
device against the local server, including a launch that applies queued
changes through the companion. The contract is phase 2's
(`native-api.ts`, `native-requests.ts`, `bridge.ts`) and "Native rules"
below; the app harness's `tests/app/native.ts` and `relay.ts` are the
reference native it mirrors.

The phone checks left from phase 0 (wireless debugging, the Hyper-V
firewall rule, Q6 on the phone, a current WebView) need the owner's phone
and an admin PowerShell; they wait for the owner, and the work below runs
on the emulator meanwhile (`MLPixel37`, WebView 145).

Packages, each committed on its own after tests first, `pnpm verify`, the
Kotlin tests, a check on the emulator, a code review and a security review:

1. **Project and build.** `packages/android` (Gradle wrapper, AGP,
   androidx.webkit, coroutines, kotlinx-serialization's JSON, Custom Tabs,
   JUnit with coverage); `pnpm android:build` (after `pnpm build`) and
   `pnpm android:test`; `dist-app/` copied into the APK's assets without the
   source maps; the version from the extension's manifest; the manifest
   (one exported activity, no backup, `dataExtractionRules` leaving
   everything out, cleartext allowed, no URL taken from an intent); our
   icon; debug and release builds, the release signed with a key kept out
   of git; the WebView check (the two features, and version 146 for
   Foundry 14) with its message.
2. **Native core** (plain Kotlin, JUnit). The wire format; the rules
   (who may ask what, sender paths, Setup and game pages of a saved
   server, payload limits, NativeFetch's rule, outside links) checked
   against vectors that the TypeScript writes from its own functions, so
   the two can't drift; the key-value store in app-private files; native's
   own state (saved origins, registered scripts, Release history, the last
   server); NativeFetch; the relay (`route` held until
   `background.ready`, replies only from the background, the sender built
   with a JSON library).
3. **The three WebViews.** The background (hidden, on the asset origin),
   home and the server WebView: document-start scripts and the bridge for
   saved origins only, the sender from the last committed navigation,
   hardening, cookies kept, certificate errors refused with a message,
   system bars and the keyboard kept clear, the server's own pages in the
   WebView and others in a Custom Tab, Back (Setup's own Back through the
   bridge, then history, then home). Shared UI: the home screen's app
   words, servers that open on a tap, "Not encrypted" on plain http;
   Foundry's `/join` Join button at phone width after a launch.
4. **Files, dialogs and links.** `files.save` and `files.open` through the
   system picker, `confirm` as a native dialog (one at a time, the server's
   name in the title), `openExternal` (the rule, at most one a second),
   Foundry's own file inputs.
5. **On the device.** A live run on the emulator through Playwright's
   Android support: add the server, Setup takes over, a queued change,
   launch and apply through the companion, export and import, Release
   history; the signed release APK installed and checked; screenshots;
   the results artifact.

### Phase 4 progress

1. **Project and build** (done 2026-11-08). `packages/android`: AGP 9.4.1,
   androidx.webkit 1.18.0, activity 1.13.0, browser 1.9.0, coroutines
   1.10.2, kotlinx-serialization-json 1.9.0 (its JSON tree only, no
   compiler plugin), JUnit 4.13.2 with JaCoCo. `pnpm android:build` runs
   `pnpm build`, then `assembleDebug assembleRelease` through
   `scripts/android/gradle.ts` (JDK 21 from `~/opt`, the SDK in
   `~/Android/Sdk`); `pnpm android:test` runs the Kotlin tests with a
   coverage report. The APK's assets are `dist-app/` without source maps
   (a missing build says to run `pnpm build`); the version is the
   extension's (0.2.0, version code 200). Debug builds are
   `dev.modulelibrary.app.debug` beside the release's
   `dev.modulelibrary.app`. The release is minified and signed with a key
   in `~/.config/module-library/` (`android-release.jks` and
   `android-signing.properties`, outside git; without it the release is
   built unsigned, with a warning). Manifest: the launcher activity only
   (no data filter, `taskAffinity` empty), no backup or device transfer of
   anything, cleartext allowed, the system's certificates only. Our icon:
   books on a shelf (adaptive, with a monochrome layer), **for the owner
   to approve**. The WebView check (`web/WebViewSupport.kt`): without
   document-start scripts or the message listener, a stop with Update;
   below 146, a warning once per WebView version; the emulator's 145
   shows it. Checked on the emulator: debug and release start, the
   warning shows. Reviews: no critical or high; fixed the missing-build
   message, the Play Store link for the phone's own WebView package,
   signing settings named when missing, the runner's errors and JDK
   lookup, key files git-ignored.
2. **Native core** (done 2026-11-08). `core/` in plain Kotlin (no Android
   classes, all JUnit): `Contract` (names, limits, who may ask what),
   `WebUrl` (java.net.URI over WebView's canonical URLs; what it can't
   read is refused), `Rules` (NativeFetch's rule, Setup and game pages,
   `mayAskAsServer`, `externalAllowed`, `savableServerOrigin`,
   `wrapForServer` with JSON.stringify's escaping), `Payloads`, `Wire`,
   `KeyValueStore` (a file per key named by its SHA-256, written to a
   temporary file, synced, then moved over the old), `NativeState`,
   `MessageRules` (main frame and committed origin, Back's order, the
   server's name for dialogs), `NativeFetch` and `Relay`. The three server
   rules moved into `native-api.ts` so the harness and the app share them.
   **Contract vectors**: `packages/extension/test/app/contract-vectors.ts`
   writes the TypeScript's answers (`node scripts/android/contract-vectors.ts`)
   to `packages/android/app/src/test/resources/contract-vectors.json`;
   Kotlin's `ContractVectorsTest` checks them and a Vitest test fails when
   the file is stale. They caught JavaScript's `\s` (no U+0085, but
   U+FEFF), zod 4 wanting an `unknown` field present, and Java's port
   range. `pnpm android:test` fails below 80% lines or branches in `core`
   and `web` (now 98.7% and 86.4%). Reviews (Kotlin: two high; security:
   one high), all fixed with tests: a request that timed out inside native
   never answered its page; NativeFetch's limit couldn't stop a trickling
   body (a watchdog now closes the connection at the deadline); no cap on
   requests waiting (16 per page, 16 M characters in all, the background
   exempt, large messages read off the main thread); trailing-dot hosts
   (`foundryvtt.com.`) could be saved as servers (TypeScript too); a server
   page without rights could answer native's questions; native's own error
   text reached pages (now only native's refusals; the rest is "Native
   failed" and the log); a corrupt state file crashed every start; ports
   past 65535. Left, with reasons: a late message from a background page
   that has just reloaded can't be told from the new one's (native never
   reloads it but after a crash); outside links need a recent tap on the
   server WebView (package 4: native sees taps, a message doesn't); no
   storage quota per key-value store.
3. **The three WebViews** (done 2026-11-08). `MainActivity` holds the
   background (one pixel, under the others, so its timers aren't slowed),
   home and the server WebView; `web/Clients.kt` (home and background:
   only the asset loader's pages, no navigation; home opens a saved
   server on a tap, outside links in a Custom Tab; the server WebView: its
   saved servers' pages only, main-frame loads elsewhere blocked even for a
   form's POST, a tapped outside link in a Custom Tab, certificate errors
   cancelled with one dialog naming the saved server), `web/PageBridge.kt`
   (the committed page from `onPageStarted`, which on the emulator gives
   the address after a redirect; replies only to the document that asked),
   `web/Injection.kt` (all app-setup scripts before all app-game scripts),
   `web/Hardening.kt`, `web/Links.kt`. The app opens the last server's
   Setup, else home; after a renderer crash, home. **Back** asks our Setup
   page (`back` over the bridge, answered `{handled}`); Setup plays an
   Escape only it can make (`ui/shell/phone/back.ts`, a private WeakSet; no
   key code, since Foundry's keybindings claimed every press with one, and
   stopped at the document), then the history (not to `/auth`), then home;
   Back on home leaves the app, or returns to the server when home was
   opened as Module Library settings; a second Back within 2 s goes on even
   if the page claimed the first. Shared UI: the home screen's servers open
   on a tap, plain http says "Not encrypted", the app's own words;
   Foundry's window-size notice is cleared on `/join` (it covered the Join
   button) and `/auth` (it covered the password), waiting for Foundry's
   notification area there. Checked on the emulator
   (`scripts/dev/android-app.ts` drives the debug app with Playwright's
   Android support): add a server, open it, admin login, our Setup page,
   Back through a world, Setup, home and out, settings and back, the notice
   gone on `/auth`, a form POST to another site blocked. Reviews (code: two
   high; security: two medium), fixed: Back read the history before Setup
   answered; certificate dialogs could stack or come after closing, and
   named any site; a renderer crash recreated the activity up to three
   times and could loop on the last server; the activity could start after
   it was destroyed; replies could reach destroyed WebViews; the bridge
   was on saved origins without scripts; release logs carried addresses;
   an origin rule WebView refuses would crash every start. One claim
   checked and not so: `onPageStarted` reports the address after a
   redirect. Left: pages already open keep the scripts and bridge they
   started with until reloaded; Foundry's unreachable-server page is
   Chromium's own; the background keeps running while the app is in the
   background; a saved server's page can navigate to another saved server
   without a tap (both the user's).
4. **Files, dialogs and links** (done 2026-11-08). `Pickers.kt` (the
   system Save and Open pickers and Foundry's own file inputs, one at a
   time and not again within 2 s; a picker counts as open until Android
   returns its result, so a later request can't take an earlier picker's
   file; the page's file name only a suggestion, tidied and ending in
   `.json`; an import at most 6 M characters; only `content:` results for
   file inputs), `AndroidUi.kt` (a native yes-or-no titled "Module Library
   · server", the question without hidden or reordering characters and
   long gaps), `core/UserInput.kt` (`TapRule`: a short, still,
   one-finger press on the server WebView, seen by native's touch
   listener; an outside link needs one within 1 s, whether the page asks
   or the WebView navigates, and each tap opens one link). Found on the
   emulator: Foundry's Setup page opens new-tab links itself from a
   document-level click handler, so in the app one tap opened two tabs
   (our `openExternal` and Foundry's `window.open`, which becomes a
   navigation with one window); a link our page takes over now stops
   there (`ui/ports.ts`; the extension's links stay the browser's). And
   WebView's gesture flag is set by input that never touched the screen,
   so native checks its own taps. Checked on the emulator: export through
   Save (the file's JSON read back), import through Open, the dialog with
   the server's name, Cancel and OK ("Library imported."), a click without
   a touch opens nothing, a real tap one Custom Tab, Back returns. Not
   checked: Foundry's own file inputs (Setup shows none in normal use).
   Reviews (code: one high; security: two high), fixed: a cancelled
   request freed its picker's slot while the picker was still open; the
   dialog's text could hide or reorder words; scrolls and long presses
   counted as taps, and one tap could open several links; the dialog
   could be dismissed off the main thread; a page's file input could wait
   forever after the activity closed. Left, with reasons: TalkBack and
   keyboard activation send no touch, so they can't open outside links
   (the rule's price); a picker's provider that never answers holds a
   read.
5. **On the device** (done 2026-11-08). `scripts/dev/android-run.ts`
   (replaced by `pnpm test:android` in phase 5) ran the debug app end to end on the emulator (Playwright's Android
   support for the WebViews, adb and uiautomator for native UI,
   `scripts/dev/android-ui.ts`): installed with no data, the server added
   on home, admin login, the test world launched from our Setup page,
   Foundry's `/join` with its Join button clear, joined as the Gamemaster
   and the companion's report (HELLO, snapshot, commands, recorded on the
   page), Fixture A queued (its library comes along), applied through the
   launch review, the world's active modules then Fixture A, its library
   and the companion, and back on Setup "3 modules on". **The phase's
   done condition holds.** Export and import, dialogs and outside links
   were checked in package 4. The signed, minified release APK
   (`dev.modulelibrary.app`, 0.7 MB, no source maps) installed on the
   emulator: home answers through the background, a server added and
   opened shows our running-world screen (a world ran then), so the
   release runs our injected scripts too; it is in the owner's Windows
   folder as `C:\Users\fagot\ml-apk\module-library-0.2.0.apk`. Found on
   the way and fixed: **the companion's HELLO waited 1 s, five times**,
   and in the app the first answer came after about 1.3 s, every run
   (the game page and our background share one renderer, which the game
   keeps busy while it loads); one run had every try unanswered. The
   waits now grow, 1 to 5 s (15 s in all; only a world without the
   extension waits longer before its one notice). And **the running-world
   screen stayed blank** when the world closed while `/join` loaded
   (Foundry's data never came); it now asks the status while it waits and
   goes to Setup. Reviews: no critical or high; fixed a redirect that
   could repeat, status questions that could pile up, a stale comment,
   a test for an answer on a later try. Not done in phase 4: Release
   history on the device (its switch works on home; foundryvtt.com
   wasn't fetched from the emulator), and the phone itself (below).

**For the owner after phase 4:**

1. **The phone checks** left from phase 0 need you: wireless debugging
   paired with Windows' adb, the Hyper-V firewall rule for port 30000
   (`docs/ANDROID-SPIKE.md`, "Devices and network", admin PowerShell),
   Android System WebView 146 or newer from the Play Store, then the APK
   above installed and the server added as `http://192.168.178.25:30000`.
2. **The icon** (books on a shelf) and **the home screen** (the
   extension's settings panel with the app's words, servers that open on
   a tap) were made without a design to follow; both are for you to
   approve or redesign.
3. **The release key** in `~/.config/module-library/` signs every future
   APK: phones with this one installed take updates only from it. Keep a
   copy somewhere safe.
4. **Accessibility trade-off:** outside links open only after a real tap
   (a page can't open sites by itself); TalkBack and keyboard activation
   send no tap, so they can't open them.

## Phase 5: on-device suite and acceptance (started 2026-11-09)

Done when the smoke suite passes on a device and the owner can install the
APK. The suite runs on any device Windows' adb sees: the emulator now, the
owner's phone once its checks are done (phase 4, "For the owner"; no phone
was connected when phase 5 started).

Packages, each committed on its own after `pnpm verify`, a run on the
emulator, a code review and a security review:

1. **The suite and its fixtures.** `tests/android/` with
   `playwright.android.config.ts` (`pnpm test:android`): the device by
   `ML_ANDROID_SERIAL` (else the only one), the server as that device
   reaches it (`ML_APP_SERVER`, else the emulator's `10.0.2.2`), the debug
   APK installed with no data, the WebView notice answered once per
   version, pages found again after the app's WebViews change, native UI
   through uiautomator, screenshots per device and theme; no traces (they
   would hold the admin login). The dev script's helpers move here.
2. **The smoke specs.** Add a server, Setup takes over; a world (open it,
   Back steps out); the Library (the tab, a filter, its menu); a queued
   change, launch and apply through the companion; export and import
   through the system pickers and the native dialog; Release history
   (allowed on home, the Update page reads foundryvtt.com); the key
   screens in Foundry's three Setup themes, the theme put back after.
3. **Acceptance.** A full run on the emulator (and on the phone when it
   is connected), the APK in the owner's Windows folder, the results
   artifact.

### Phase 5 progress

1. **The suite and its fixtures** (done 2026-11-09). `tests/android/`:
   `native-ui.ts` (adb with the device's serial, uiautomator; moved from
   `scripts/dev/android-ui.ts`), `app.ts` (the debug APK installed with no
   data and the WebView notice answered through `run-as`, pages looked
   for again on a new connection, screenshots in
   `test-results/screens/android/<device>/<theme>/`), `foundry.ts` (admin
   login in the server WebView, the companion's talk recorded on the page,
   worlds closed, themes set), `playwright.android.config.ts` (`pnpm
test:android`, no traces). First spec, `start.spec.ts`: a fresh install
   opens on home, answered by the background. Passes on the emulator.
   Small enough to be reviewed together with package 2.
2. **The smoke specs** (done 2026-11-09). `smoke.spec.ts` (steps in
   `steps.ts`), one serial run from a fresh install: a server added on
   home and our Setup page; a world opened and left with Android's Back;
   the Library (its tab, a filter, its menu, which Back closes and only
   it); export through Save and import of that file through Open, the
   app's dialog naming the server, OK, "Library imported." (the device's
   own exports are left alone, the new file told apart by name); the first
   launch from our page with Foundry's Join button clear and the
   companion's report; Fixture A queued, applied through the review,
   active in the world, Setup showing 3 on after the companion's report
   from the reloaded page; Release history allowed on home and read from
   foundryvtt.com through native (Foundry's update check answered with
   its real notes as a newer build, read beforehand from WSL since
   `route.fetch` doesn't finish on a WebView); Setup, a world and the
   Library in Foundry's three themes, the theme put back. 9 tests pass on
   the emulator in about 6 minutes. Found by the suite: **Back left the
   page when Setup answered late** (over 0.8 s on the emulator, the app
   went home with a menu open); the app now waits 1.5 s and stays when
   there's no answer. Reviews (code: four high, all in the suite; security:
   one medium), fixed: cleanup that could overwrite the theme with a guess
   or stop at its first failure; a page used after its connection closed;
   fixed sleeps where a condition can be waited on; a page that never
   answers Back could keep the user in (the "again soon" window counted
   from the press, and presses during the wait were dropped; now it counts
   from the claim, and a press during the wait goes on); a timeout told by
   its message's words (now `PageTimeout`); other failures of Back's
   question escaped; the suite deleted the device's own exports; a second
   companion session that could pass on the first one's record.
3. **Acceptance** (done 2026-11-09). The full suite on the emulator: 9 of
   9 pass. The signed release APK of `61457e0` installs and opens on home;
   it is in the owner's Windows folder as
   `C:\Users\fagot\ml-apk\module-library-0.2.0.apk`. Results:
   https://claude.ai/artifact/Pj5rVD16GKovBGud9n8Zgx. **The phone run
   waits for the owner**: no phone was on adb (the firewall rule,
   WebView 146 and wireless debugging first, phase 4 "For the owner");
   then `ML_ANDROID_SERIAL=<phone> ML_APP_SERVER=http://192.168.178.25:30000 pnpm test:android`.

## Phase 6: the owner's first use (started 2026-11-09)

The owner tried the app and asked for (2026-11-09):

1. **Our running-world screen always**: after a launch from the app too,
   not Foundry's `/join`. Decided: the screen gets **Join as Gamemaster**
   beside Return to Setup; right after a launch with queued changes it is
   the main button and says how many changes it applies (changes queued on
   the phone apply only when the GM joins from the app: the desktop
   extension has its own library).
2. **Leaving a server without its password**: from Foundry's admin login
   (and the running screen's password question) back to the server list,
   e.g. to open another server.
3. **A better home screen**, consistent with our Setup page, and adding a
   server without typing `http://`.
4. **Paste and password managers on Foundry's login**: a long press showed
   no Paste; a password manager offered the site but didn't fill.
5. **Foundry's window-size notice** showed before our page loaded.
6. **The app icon**: improve it, last, once the app works well.

Items 2 and 3, and the running screen's join (item 1), are designed first
as clickable mockups for the owner; items 4 and 5 are fixes.

Packages:

1. **Fixes** (items 4 and 5).
2. **Mockups** for the home screen, leaving a server, and the running
   screen with Join; the owner chooses.
3. **Building** what the owner chose, with the on-device suite extended.
4. **The icon.**

### Phase 6 progress

1. **Fixes** (done 2026-11-09). Foundry's `game.mjs` blocks the context
   menu on the whole document (`contextmenu` → `preventDefault`), which in
   a WebView is also the long-press menu with Paste: in a text field the
   event now stops at the window first (`page/text-fields.ts`,
   `allowTextMenus`, on every server page), and Paste and Select all show
   (checked on the emulator in Foundry's admin password field). Foundry's
   admin and join password fields now carry `autocomplete="current-password"`
   (`hintPasswords`), and only the WebView in front is offered to
   password managers (`importantForAutofill`; the hidden home and
   background WebViews were in the autofill structure too). The owner's
   case (offered, not filled) couldn't be reproduced on the emulator,
   where the server WebView started no autofill request at all; to check
   on the phone with the owner's password manager. Foundry's window-size
   notice now goes from document start on a touch screen (Setup) and on
   `/auth` and `/join` (it no longer waits for the page to load): on the
   emulator the notice is added and removed in the same moment, before a
   frame is drawn. Found on the way: a phase 5 run before its review fixes
   had left Foundry on the sci-fi theme (its cleanup stopped at its first
   failure, and the next run took sci-fi as the owner's); dark is back,
   and the themes test now puts the theme back as soon as it ends. Review
   (one high, fixed: observers attached to a document root that may not
   exist yet at document start now observe the document; the password
   hints stop a moment after load; `plaintext-only` fields count as text).
   The on-device suite passes (9 of 9).
2. **Mockups** (published 2026-11-09, waiting for the owner):
   `design/app-screens/index.html`,
   https://claude.ai/artifact/M1rAQfU44fu4FbhFDVpzvi. Home A (servers
   first, cards, Add a server at the bottom) or B (a settings-style list);
   adding a server with an http/https toggle, no protocol typed, and a
   check that Foundry answers; leaving Foundry's login by a bar on top (A)
   or a floating button (B); the running screen after a launch (Join as
   Gamemaster with the changes it applies, a sheet for the user and
   password) and when opened later. **The owner's choices (2026-11-09):**
   home A ("looks much nicer"), with a clear way to edit and remove a
   server, now in the mockup (a ⋮ on each card opens the server's sheet:
   name, address with the http/https toggle and its library kept, Remove
   this server… which asks first); leaving Foundry's login by the bar on
   top (A).

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
- **Not from the spike** (phase 3 package 7 security review): the spike's
  activity is exported, loads any `url` extra and turns on WebView
  debugging always. The app ties debugging to `BuildConfig.DEBUG`, takes
  no URL from an intent, and never looks for the preview's `preview.js`.
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
  operations (delete, import), checked by the background, would close it.
  The owner accepted the risk and skipped the token for v1 (2026-11-08): a
  script that can run on Setup already has Foundry's admin powers there,
  so the token would guard only the app's own notes about that server
  (presets, tags, world module lists, settings), which can be rebuilt.
  Revisit if the app keeps something that can't be rebuilt or is
  sensitive, or if it is used over plain http on untrusted networks.

## Risks

- **Old WebViews.** The two WebView features need an up-to-date Android
  System WebView; without them the app says so and offers Foundry's own page.
- **Foundry's own pages on a phone.** `/auth`, `/join` and the game screen
  stay Foundry's desktop pages; the game screen is out of scope.
- **Two builds of one UI.** The platform layer and a test that the app bundle
  holds no `chrome.*` keep them apart; the live suites run on both.
- **Unknown Foundry versions.** Safe mode and a failed mount leave Foundry's
  page alone, as in the extension.
