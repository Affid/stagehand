# Stagehand for Foundry VTT

Named Stagehand on 2026-11-09 (before: Module Library, a working name). Code
names keep the old one: the `@module-library/*` workspace packages, the
Android package `dev.modulelibrary.app` and the test world
`module-library-test`.

Organise installed Foundry VTT modules on the Setup screen (folders, tags,
notes, smart groups, authors), see which modules each world uses, and apply
presets to a world in **add**, **replace** or **remove** mode with a diff
preview. The design is in [docs/PRD.md](docs/PRD.md).

Two parts, as the PRD describes:

- **Browser extension** (`packages/extension`): enhances the Setup page and
  holds the library, world snapshots and the command queue.
- **Companion module** (`packages/module`, id `stagehand`): runs inside
  each world for the full Gamemaster, reports the world's modules and applies
  queued changes after confirmation.
- **Shared logic** (`packages/shared`): protocol, schemas, the library model
  and the apply resolver, used by both.

Status: M0 spike and M1 (MVP) on Foundry V14. See
[docs/M1-STATUS.md](docs/M1-STATUS.md) for what is done and what is open.

## Development

Requirements: Node 22.18+, pnpm 12, a local Foundry (see below).

```bash
pnpm install
pnpm build            # extension -> packages/extension/dist, module -> packages/module/dist
pnpm test             # unit tests (Vitest)
pnpm test:coverage    # with the 80% threshold
pnpm lint && pnpm typecheck && pnpm format:check
pnpm verify           # all of the above
```

Load the extension unpacked from `packages/extension/dist` (Chrome:
`chrome://extensions`, developer mode). Open your Foundry server, click the
extension's toolbar button and choose Use Stagehand here (or add the
server's address, for example `http://localhost:30000`), then allow the
site. The same panel opens from the Setup page's rail and as the
extension's options.

## Android app

The app (`packages/android`, Kotlin; docs/ANDROID-APP-PLAN.md) shows the
same Setup page in a WebView. It needs JDK 21 in `~/opt/jdk-21*` and the
Android SDK in `~/Android/Sdk` (or `ML_ANDROID_JAVA_HOME` and
`ANDROID_HOME`); see docs/ANDROID-SPIKE.md for the install.

```bash
pnpm android:build    # pnpm build, then the debug and the signed release APK
pnpm android:test     # Kotlin unit tests, with the 80% coverage gate
pnpm test:android     # the app end to end on a device (the emulator by default)
```

`pnpm test:android` needs the emulator (or a phone) on Windows' adb and
the local Foundry on Setup; for a phone, set `ML_ANDROID_SERIAL` and
`ML_APP_SERVER` (the server as the phone reaches it). The APKs land in
`packages/android/app/build/outputs/apk/`. The release
is signed with the key in `~/.config/module-library/` (outside git; built
unsigned without it). `node scripts/android/contract-vectors.ts` rewrites
the native rules' answers the Kotlin tests check, after a change to
`packages/extension/src/app/native-api.ts` or `native-requests.ts`.

## Local Foundry

Settings come from `.env.local` (copy `.env.example`): Foundry's app and data
folders, port and administrator password. The same Foundry install serves the
ModularAV project.

```bash
pnpm foundry:start    # runs Foundry (V14 Node build) in the foreground
pnpm build && pnpm foundry:link   # links the module and test fixtures into Data/modules
pnpm foundry:setup    # creates the module-library-test world and its users, safe to repeat
pnpm test:foundry     # end-to-end suites against the running Foundry (~5 minutes)
```

The test world has `Gamemaster` (full GM), `Assistant` (Assistant GM) and
`Player1`, all without passwords. `fixtures/modules` holds three tiny test
modules: a library, a module that requires it, and one that conflicts with it.

### An older build

The Update page's checks against a real newer release
(`tests/foundry/setup-update-older.spec.ts`) run only on an older Foundry
build; on the usual up-to-date server they skip. Stop the usual server, then
run a copy of an older build with a copy of the data, so neither the install
nor the worlds are touched:

```bash
cp -a ~/foundry/vtt-14.369-backup ~/foundry/test-369/vtt
cp -a ~/foundry/data ~/foundry/test-369/data
FOUNDRY_APP_DIR=~/foundry/test-369/vtt FOUNDRY_DATA_DIR=~/foundry/test-369/data \
  FOUNDRY_ALLOW_UPDATE=1 pnpm foundry:start
pnpm test:foundry setup-update-older
```

The tests never press Update. Delete `~/foundry/test-369` afterwards and
start the usual server again.

## Layout

```
packages/shared      protocol, Zod schemas, version logic, resolver, library ops
packages/extension   background, Setup adapters, Setup UI (Preact), bridge, options
packages/module      companion module: session, apply flow, dialog
packages/android     Android app: WebViews, native bridge (Kotlin, Gradle)
scripts/foundry      local Foundry helpers (admin API, world setup, linking)
tests/foundry        Playwright end-to-end suites (Setup UI, in-world apply)
tests/android        the on-device suite for the Android app
docs                 PRD, M0 findings, M1 status
```
