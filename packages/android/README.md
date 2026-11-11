# Stagehand Android app

Stagehand's Setup page on a phone or tablet, for the Foundry servers you
add in the app. The app is a native shell (Kotlin) around WebViews that
run the [extension](../extension/README.md)'s web code, built for the app
into `packages/extension/dist-app`. It shows only Stagehand's own pages,
never Foundry's game.

## Install

Download the APK from the
[releases](https://github.com/Affid/stagehand/releases) and sideload it.
Android 8 or newer, with Android System WebView 146 or newer (Foundry 14's
pages need it; the app says so if the phone's is older). For the world's
module list, install the [companion module](../module/README.md) in
Foundry too.

## Development

Needs JDK 21 in `~/opt/jdk-21*` and the Android SDK in `~/Android/Sdk` (or
`ST_ANDROID_JAVA_HOME` and `ANDROID_HOME`); see
[docs/ANDROID-SPIKE.md](../../docs/ANDROID-SPIKE.md) for the install. Run
from the repository root:

```bash
pnpm android:build    # pnpm build, then the debug and the signed release APK
pnpm android:test     # Kotlin unit tests, with the 80% coverage gate
pnpm test:android     # the app end to end on a device (the emulator by default)
```

The APKs land in `app/build/outputs/apk/`. The release is signed with the
key in `~/.config/stagehand/` (outside git; built unsigned without it).
`pnpm android:build` ships the dev build label; for a release, build the
web part with `pnpm --filter @stagehand/extension build:release`, then
`node scripts/android/gradle.ts assembleRelease`. The version is the
extension's (`packages/extension/static/manifest.json`).

Source, in `app/src/main/kotlin/io/github/affid/stagehand`:

| Folder      | What it holds                                                                           |
| ----------- | --------------------------------------------------------------------------------------- |
| (top level) | The activity, our login screen, native sheets and pickers, the look of native screens   |
| `web/`      | WebView setup and hardening, the document-start scripts, the page bridge, outside links |
| `core/`     | The bridge's wire format and rules, request payloads and limits, storage, native fetch  |

Native and the web code talk through a message bridge. Its names, limits
and rules live on both sides: `core/Contract.kt`, `core/Rules.kt` and
`core/Payloads.kt` here, `src/app/native-api.ts` and `native-requests.ts`
in the extension. `ContractVectorsTest` checks that both give the same
answers; after a change to the TypeScript side, run
`node scripts/android/contract-vectors.ts` to rewrite the vectors.

- [docs/ANDROID-APP-PLAN.md](../../docs/ANDROID-APP-PLAN.md): the app phase
  by phase, its native rules and security.
