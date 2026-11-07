# Android spike (phase 0)

Phase 0 of `docs/ANDROID-APP-PLAN.md`: the tools, and a throwaway app that
answers the spike questions on a real device. Started 2026-11-07.

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

- **Emulator** (owner's Windows, Android Studio): reaches the WSL Foundry at
  `http://10.0.2.2:30000` (the emulator's name for Windows' localhost, which
  mirrored networking shares with WSL). adb from WSL: `adb connect
127.0.0.1:5555`.
- **Phone** (wireless debugging, same Wi-Fi): reaches Foundry at
  `http://192.168.178.25:30000` once Windows lets the port in for WSL (a
  Hyper-V firewall rule, run once by the owner as admin). adb from WSL:
  `adb pair` then `adb connect` with the addresses the phone shows.

## Questions

| #   | Question                                                                | Answer               |
| --- | ----------------------------------------------------------------------- | -------------------- |
| 1   | Document-start scripts and message listeners available; WebView version | waiting for a device |
| 2   | Veil `<style>` in place before the first paint                          | waiting for a device |
| 3   | Admin login cookie survives an app restart                              | waiting for a device |
| 4   | Main-world game-bridge meets the companion's HELLO                      | waiting for a device |
| 5   | Bridge kept in the closure, global name removable                       | waiting for a device |
| 6   | Plain http from emulator and phone to the WSL server                    | waiting for a device |
| 7   | Playwright drives the app's WebView from WSL                            | waiting for a device |
| 8   | Font Awesome and Foundry's fonts load in the WebView                    | waiting for a device |
