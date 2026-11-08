# Android app: the new Setup page on a phone

Status: planned 2026-11-07; phase 0 closed the same day (answered on the emulator; the phone checks moved to phase 4); phase 1 (phone design): the owner chose the tabs layout and, after the rounds below, moved on to development on 2026-11-08; two questions stay open until phase 3 (see "Phase 1" below). Next: phase 2. The owner's decisions are below. Owner's choices: an Android app that
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

| #   | Phase                                                  | Scope                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Done when                                                                                                                                        |
| --- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0   | **Tooling and spike**                                  | JDK 21, Android SDK command-line tools, platform tools, Gradle wrapper in WSL (with the owner's go-ahead and SDK licence acceptance); a test device; a throwaway app that loads the local server and proves the risky parts.                                                                                                                                                                                                                                                                                  | `docs/ANDROID-SPIKE.md` answers every spike question below on a real device. Done on the emulator; the phone part moved to phase 4.              |
| 1   | **Phone design**                                       | Interactive mockups of the Setup page on a phone in Foundry's look (design kit, header switcher between variants, as for the desktop design); the owner picks; the result added to `design/setup-page/` and `docs/SETUP-REDESIGN.md` (a "Phone" section).                                                                                                                                                                                                                                                     | The owner approves the phone layout; it is the spec from then on.                                                                                |
| 2   | **App platform layer** (TypeScript, no Android needed) | An `app` target in `build.ts` (`app-setup.js`, `app-game.js`, `app-background.js`, `app-home.js`); the platform interfaces over a `NativeBridge` port; the private setup-main/setup-ui channel; `files`, `confirm` and `openExternal` ports used by both builds (the extension keeps its behaviour); a fake bridge for tests; an **app harness**: Playwright with phone emulation that injects the app bundle into the local Foundry and plays the native side in Node.                                       | Today's Setup page runs in the harness through the app layer, desktop layout, live tests passing; the extension build unchanged.                 |
| 3   | **Phone layout** (shared UI)                           | The approved design behind a width breakpoint: the rail becomes the home list, a world, the Library and each server page full screen with Back, details as a full-screen sheet, header actions in one menu; 48 dp touch targets; hover-only controls shown on touch screens (`hover: none`); explanations that now live only in `title` tooltips get a visible or tap-to-show form; fixed widths released under the breakpoint.                                                                               | Every page and panel works at 360, 412 and 768 px wide in the three Setup themes; axe clean; desktop layouts unchanged (`setup-layout.spec.ts`). |
| 4   | **Android app** (Kotlin)                               | `packages/android` (Gradle, its own build, `pnpm android:build` runs it after `pnpm build`): home screen, server WebView with injection and bridge, background WebView, key-value store, NativeFetch, files, dialogs, Custom Tabs, Back (Setup's own Back first, then history, then home), cookies kept, certificate errors refused with a message, debug and signed release APKs. Starts with the phone checks left from phase 0: wireless debugging, the firewall rule, Q6 on the phone, a current WebView. | The app runs the Setup page on a device against the local server, including a launch that applies queued changes through the companion.          |
| 5   | **On-device suite and acceptance**                     | Playwright attached to the app's WebView over adb (Playwright's Android support or CDP through `adb forward`), a smoke suite on the device: add a server, Setup takes over, a world, the Library, a queued change, launch and apply, export and import, Release history; screenshots in the three themes; results artifact; the APK copied to a Windows folder for the owner.                                                                                                                                 | The smoke suite passes on a device; the owner can install the APK.                                                                               |

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
  `scripts/dev` screenshots at 360, 412 and 768 px in each theme.
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

Still open: **tablets** (the phone layout up to which width; the 1280
layout floats the details panel and suits a landscape tablet, a portrait
tablet at 768-1024 could take either), decided with the phone design in
phase 1.

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
- From 700 px wide and 600 px tall (a tablet held upright) the worlds list
  stays on the left and sheets slide in from the right.

Still open, to settle before phase 3 (phase 2 doesn't depend on them):

1. **A tablet held upright** (768 px): the worlds list on the left, as the
   mockup shows, or the phone layout.
2. **Anything left off the phone**, for example the By world grid or
   Configuration. The mockup brings every page.

Still open: the tablet-upright layout and whether anything stays off the
phone. The approved layout goes into `docs/SETUP-REDESIGN.md` (a "Phone"
section).

## Risks

- **Old WebViews.** The two WebView features need an up-to-date Android
  System WebView; without them the app says so and offers Foundry's own page.
- **Foundry's own pages on a phone.** `/auth`, `/join` and the game screen
  stay Foundry's desktop pages; the game screen is out of scope.
- **Two builds of one UI.** The platform layer and a test that the app bundle
  holds no `chrome.*` keep them apart; the live suites run on both.
- **Unknown Foundry versions.** Safe mode and a failed mount leave Foundry's
  page alone, as in the extension.
