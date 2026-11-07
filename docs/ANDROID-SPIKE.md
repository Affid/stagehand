# Android spike (phase 0)

Phase 0 of `docs/ANDROID-APP-PLAN.md`: the tools, and a throwaway app that
answers the spike questions on a real device. Started and closed 2026-11-07:
every question is answered on the emulator; the phone checks (Q6 on the
phone's Wi-Fi, and a WebView of version 146 or newer) moved to the start of
phase 4, when there is a real app to install (owner, 2026-11-07).

## Tooling (done)

Installed in WSL without root, every download checked against its published
checksum:

| Tool                           | Version                        | Where                                 |
| ------------------------------ | ------------------------------ | ------------------------------------- |
| JDK (Eclipse Temurin)          | 21.0.13+9                      | `~/opt/jdk-21.0.13+9`                 |
| Android SDK command-line tools | 22.0                           | `~/Android/Sdk/cmdline-tools/latest`  |
| Platform tools (adb)           | 37.0.1                         | `~/Android/Sdk/platform-tools`        |
| Android platform               | 36                             | `~/Android/Sdk/platforms/android-36`  |
| Build tools                    | 36.0.0 (fetched by AGP)        | `~/Android/Sdk/build-tools`           |
| Gradle                         | 9.8.2 (wrapper in the project) | `~/opt/gradle-9.8.2` made the wrapper |

The owner accepted Google's Android SDK licence for the install. Versions are
at least two weeks old (Gradle 9.9.0 and AGP 9.5 were newer and skipped).
The system Java is 25, which AGP doesn't take; builds set `JAVA_HOME` to the
JDK above.

## Spike app (built)

`spikes/android/`: AGP 9.4.1 (its built-in Kotlin), androidx.webkit 1.18.0,
minSdk 26, target 36. One activity: a status line and a WebView that loads a
server (`--es url ...`, default `http://10.0.2.2:30000/setup` for the
emulator). For the server's origin it registers the `mlApp` message listener
and adds `assets/probe.js` at document start; the probe reports to logcat
under the tag `MLSPIKE`. Plain http allowed; WebView debugging on.

Build: `cd spikes/android && JAVA_HOME=~/opt/jdk-21.0.13+9 ./gradlew assembleDebug`
(`local.properties` holds `sdk.dir`, git-ignored).

## Devices and network

- **Emulator** (owner's Windows, set up from WSL without Android Studio): the
  Windows SDK in `C:\Users\fagot\Android\Sdk` (emulator, adb, system
  images) installed by WSL's `sdkmanager` with `REPO_OS_OVERRIDE=windows`;
  two virtual phones written by hand in `C:\Users\fagot\.android\avd`
  (`MLPixel`: Android 16, API 36; `MLPixel37`: Android 17, API 37), Pixel 8
  screen (412×894 CSS px at 2.625). Windows' hypervisor (WHPX) is usable,
  although `Win32_OptionalFeature` lists `HypervisorPlatform` as off.
  Started from WSL: `emulator.exe -avd MLPixel37 -no-boot-anim -no-audio`.
- **adb from WSL:** the emulator starts Windows' adb server, which holds
  port 5037 for WSL too (mirrored networking), so WSL's own adb can't start.
  Use Windows' `adb.exe` from WSL; APKs are installed from a Windows path.
- **The emulator reaches the WSL Foundry** at `http://10.0.2.2:30000`.
- **Phone** (wireless debugging, same Wi-Fi): set up at the start of phase 4.
  It needs `http://192.168.178.25:30000` let in by a Hyper-V firewall rule
  (owner, admin PowerShell):
  `New-NetFirewallHyperVRule -Name FoundryDev30000 -DisplayName "Foundry dev (WSL) 30000" -Direction Inbound -VMCreatorId '{40E0AC32-46A5-438A-A0B2-2B479E8F2E90}' -Protocol TCP -LocalPorts 30000`

## Answers (2026-11-07, emulator, WebView 133 on API 36 and 145 on API 37)

| #   | Question                                     | Answer                                                                                                                                                                                                                |
| --- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Document-start scripts and message listeners | **Yes** on both images (WebView 133 and 145)                                                                                                                                                                          |
| 2   | Veil before the first paint                  | **Yes**: the script runs while the document is `loading` with no page script yet, and in the first animation frame Setup's body is still hidden by our style (a frame-by-frame screencast is left for phase 2)        |
| 3   | Admin login survives an app restart          | **Yes**: logged in, Home, force-stop, start: the app opens `/setup` without the login page                                                                                                                            |
| 4   | Main-world game-bridge meets the companion   | **The bridge side works** (a document-start listener on `/game` receives the module's messages), **but the companion never says HELLO on a plain-http address**: see finding 4                                        |
| 5   | Bridge kept, global name removed             | **Yes**: `delete window.mlApp` succeeds, later page scripts see `undefined`, and the reference kept in the closure still sends and receives                                                                           |
| 6   | Plain http                                   | **Yes** from the emulator; the phone check moved to phase 4                                                                                                                                                           |
| 7   | Playwright drives the app's WebView from WSL | **Yes**, with Playwright's Android support through Windows' adb server on 127.0.0.1:5037 (`scripts/dev/android-spike.ts`). `connectOverCDP` on the forwarded DevTools socket fails: a WebView has no browser contexts |
| 8   | Fonts                                        | **Yes**: Modesto Condensed, Amiri and Font Awesome 7 load from the server                                                                                                                                             |

## Findings

1. **Foundry 14 needs Chromium 146 or newer.** On the emulator's WebView
   (133 and 145) Foundry warns that it uses JavaScript features older
   Chromium lacks; Setup and a world still loaded without page errors.
   Phones update Android System WebView from the Play Store; the emulator
   images without Play can't. For a current WebView on the emulator: a
   Google Play system image, signed in once, WebView updated from the store.
   The app should compare the WebView's version with what Foundry needs and
   say how to update.
2. **Foundry warns on a phone that the window is smaller than 1024×768**
   (a notification on every page). The phone layout has to handle it.
3. **Foundry's `/join` page hides its Join button at phone width**; the
   spike submits the form. A launch from our page can land on `/join`, so
   the app needs a small fix there (outside Setup, but on the launch path).
4. **The companion module fails on any plain-http address other than
   localhost, on desktop too.** `packages/module/src/channel.ts` makes its
   request ids with `crypto.randomUUID()`, which browsers offer only in
   secure contexts (https or localhost). At `http://192.168.178.25:30000`
   (checked in desktop Chromium as well as the WebView) it is missing, the
   call throws before anything is sent, the handshake treats that as "no
   extension yet" five times and gives up: queued changes never apply at
   launch. The live suite runs on `localhost`, which is a secure context, so
   it never showed. `crypto.getRandomValues` works everywhere. The
   extension's background is unaffected (a service worker is always a
   secure context), and so is the app's background on its https asset
   origin.

   **Fixed** (owner's go-ahead, 2026-11-07): request ids come from
   `newRequestId()` in `packages/shared/src/protocol.ts`
   (`crypto.getRandomValues`), shared by the companion and the extension's
   page bridge and ids. Live: `tests/foundry/companion-http.spec.ts` joins
   the world at the machine's network address in plain Chromium (not a
   secure context) and expects the companion's HELLO; it failed before the
   fix and passes after. Reviews: code and security, no critical or high.
   Fixed from the reviews: the companion now retries only when nobody
   answers (`ChannelTimeout`) and throws anything else, so a fault like
   this is logged instead of read as "no extension"; About's "Copy the
   path" had the same class of bug (`navigator.clipboard` is missing on
   plain http, the call threw before its fallback) and now shows the path
   in a notice; the spec skips an https server and cleans up safely.

5. **The app draws under Android's bars.** From Android 15 (target SDK 35)
   apps are edge to edge: the spike's status line and the top of Foundry's
   page sit under the action bar. The real app applies the system bar
   insets (or has no action bar), and the phone layout keeps its own top
   bar clear of the status bar.
