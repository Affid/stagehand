# Stagehand browser extension

The browser extension that replaces Foundry VTT's Setup screen with
Stagehand's own Setup page, on the Foundry servers you allow it on. The
same code, built a second way, is the web part of the
[Android app](../android/README.md).

## Install

Install
[Stagehand for Foundry VTT](https://chromewebstore.google.com/detail/iilpkngpgiiocbmnnjkhmehaadnpknac)
from the Chrome Web Store. To load it by hand instead, download the zip
from the [releases](https://github.com/Affid/stagehand/releases), unpack
it, and load it in `chrome://extensions` (Developer mode, Load unpacked).
Firefox uses the same build (Firefox 128 or newer) but hasn't been tested
in a real Firefox yet.

Then open your Foundry server, click the toolbar button and choose Use
Stagehand here, and allow the site. For the world's module list, install
the [companion module](../module/README.md) in Foundry too.

## Permissions

- `storage`: your Foundry servers and module library, kept in the browser.
- `scripting`: registers the Setup page's scripts, for the servers you
  allowed only.
- `activeTab`: lets the toolbar button offer Use Stagehand here for the
  page you're on.
- Host access: optional, asked for one server at a time.

The extension talks to your Foundry server. Beyond it, it reads its Setup
page configuration (`config/setup-config.json` in this repository:
selectors and switches, never code) once a day and, only if you allow it,
Foundry's release notes on foundryvtt.com. See [PRIVACY.md](../../PRIVACY.md).

## Development

TypeScript and Preact, built with Vite by `build.ts`. Every entry is a
classic script, since content scripts, Firefox's background page and
WebView's document-start scripts can't be ES modules.

```bash
pnpm --filter @stagehand/extension build           # dist/ and dist-app/
pnpm --filter @stagehand/extension build:release   # the same without the dev build label
pnpm test packages/extension                       # its unit tests (from the repository root)
pnpm test:foundry                                  # live suites against a local Foundry
```

Load `dist` unpacked in `chrome://extensions`. `dist-app` is the Android
app's copy; Gradle packs it into the APK.

| Folder or file   | What it holds                                                                    |
| ---------------- | -------------------------------------------------------------------------------- |
| `src/entries`    | One file per built script: background, popup, the Setup page's parts, the app's  |
| `src/ui`         | The Setup page and the settings panel (Preact); `ui/shell` holds its styles      |
| `src/page`       | The half that runs in Foundry's own page: reads Setup's data, drives its actions |
| `src/background` | Saved servers, script registration, library sync, Foundry release notes          |
| `src/adapters`   | Reads the Setup page configuration and finds Foundry's elements with it          |
| `src/compat/v13` | Everything Foundry 13 does differently, in one folder                            |
| `src/app`        | The Android app's side: the bridge to native, its background, the running page   |
| `src/platform`   | The browser APIs (`chrome.*`), behind small interfaces                           |
| `src/i18n`       | The Setup page's strings                                                         |
| `static`         | `manifest.json`, icons, the popup and the base styles                            |
| `static-app`     | The app's own pages (home, background)                                           |

The Setup page runs in two halves: `setup-main` in Foundry's page, where
Foundry's data and actions are, and `setup-ui` as an isolated content
script, where the extension's APIs are. They talk with window messages
(`page-channel.ts`, `page-protocol.ts`).

- [docs/SETUP-REDESIGN.md](../../docs/SETUP-REDESIGN.md) and
  [docs/SETUP-BUILD-PLAN.md](../../docs/SETUP-BUILD-PLAN.md): the Setup
  page's design and how it was built.
- [docs/FOUNDRY-13-PLAN.md](../../docs/FOUNDRY-13-PLAN.md): Foundry 13
  support.
- [docs/store/CHROME-WEB-STORE.md](../../docs/store/CHROME-WEB-STORE.md):
  the store listing.
