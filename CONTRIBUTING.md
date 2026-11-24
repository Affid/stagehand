# Contributing

Thanks for helping. Bug reports and ideas are welcome as issues; for code,
please open an issue first so we can agree on the approach.

## Build and test

See the README's Development section. Before a pull request:

```bash
pnpm verify          # formatting, lint, types, unit tests with coverage, build
pnpm test:foundry    # live suites, against a local Foundry (README, Local Foundry)
```

CI runs `pnpm verify` on every push and pull request.

## How the code is written

- Tests first, and at least 80% coverage (the unit test run enforces it).
- Small pieces: no function over 50 lines (lint enforces it), files well
  under 800 lines.
- New objects instead of changing existing ones.
- Anything that reaches the user goes through `packages/ui/src/strings/en.json`.
- Untrusted input (Foundry's pages, world flags, files on the server) is
  checked before use.
- Stagehand talks to the user's Foundry server and nothing else, apart from
  the two reads described in the README's "Your data". Don't add telemetry
  or other network calls.
- Anything Foundry 13 does differently belongs in
  `packages/extension/src/compat/v13`, reached through `compat/quirks.ts`
  only (lint enforces it; docs/FOUNDRY-13-PLAN.md).

## Commits

Conventional commits, small and focused: `feat:`, `fix:`, `refactor:`,
`docs:`, `test:`, `chore:`, `ci:`. Say why in the body when it isn't
obvious.

## AI-assisted contributions

Welcome, on the same terms as Foundry's AI policy for listed packages: you
must understand, and be able to explain and maintain, every line you
submit.

## Releases

The companion module:

1. Add a `### Companion module <version>` section to CHANGELOG.md and
   commit it.
2. Run `pnpm release:companion <version>` (add `--dry-run` to see the
   checks first). It bumps the version in the module's manifest and
   package, runs `pnpm verify`, commits, tags `stagehand-v<version>` and
   pushes.
3. The release workflow (Actions tab) builds the zip, creates the GitHub
   release, publishes `module.json` on the `manifests` branch (the URL
   Foundry checks for updates) and, with the `FOUNDRY_RELEASE_TOKEN`
   secret set, sends the version to foundryvtt.com. If that send failed,
   the "Send companion version to foundryvtt.com" workflow sends it again.

The extension and the Android app share one version and release by hand,
under their own tags, so they never change where Foundry looks for the
companion's updates:

1. Bump the version in `packages/extension/package.json` and
   `packages/extension/static/manifest.json` (the app takes the
   manifest's), the README's Status line, and add dated
   `### Extension <version>` and `### Android app <version>` sections to
   CHANGELOG.md. Commit as `chore(release): extension and app <version>`.
2. `pnpm verify`, then `pnpm --filter @stagehand/extension build:release`:
   `dist` and `dist-app` without the dev build label.
3. Zip `dist` without the source maps, its files at the archive's root, as
   `stagehand-extension-<version>.zip`.
4. `node scripts/android/gradle.ts assembleRelease` (not
   `pnpm android:build`, which rebuilds the web part with the dev label).
   Check that the APK is signed with the same certificate as the last
   release, and attach it as `stagehand-<version>.apk`.
5. Tag `stagehand-extension-v<version>` and `stagehand-app-v<version>`,
   push, and create a GitHub release for each, the app's last so it is
   marked Latest.
6. Upload the zip to the Chrome Web Store
   ([docs/store/CHROME-WEB-STORE.md](docs/store/CHROME-WEB-STORE.md)).

When the companion releases on the same day, it goes first: its workflow
creates its own release.

## Download counts

GitHub keeps only running totals of release downloads and 14 days of
repository traffic. The Download counts workflow (Actions tab) saves a
snapshot once a day on the `stats` branch:

- `downloads.csv`: one line per release file per day, with its total so
  far. The day-to-day difference is that day's downloads.
- `traffic.csv`: views and clones per day, with unique visitors. It needs
  the `STATS_TOKEN` secret, a fine-grained token for this repository only
  with read-only Administration access; without it only downloads are
  saved. Referrers are not saved, since they name people's own servers.

After the snapshot, `scripts/stats/render.ts` draws the counts as SVG
charts (a light and a dark file each) and writes the branch's `README.md`
with them and the latest totals. The main README shows the summary card
from there (`card-light.svg`, `card-dark.svg`), so it updates without a
commit to `main`.

`node scripts/stats/snapshot.ts <folder>` takes the same snapshot by hand,
and `node scripts/stats/render.ts <folder>` draws it.
Chrome Web Store installs have no API: export them from the store's
Developer Dashboard (Analytics, Installs, Export) now and then and upload
the CSV into `chrome-web-store/` on the `stats` branch (on GitHub: open
the folder, Add file, Upload files). The next run counts it; exports may
overlap.
