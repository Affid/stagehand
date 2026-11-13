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
- Anything that reaches the user goes through `packages/extension/src/i18n/en.json`.
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
   secret set, sends the version to foundryvtt.com.

The extension and the app will release under their own tags, so they never
change where Foundry looks for the companion's updates.

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

`node scripts/stats/snapshot.ts <folder>` takes the same snapshot by hand.
Chrome Web Store installs are only in the store's Developer Dashboard.
