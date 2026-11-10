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

The companion module is released by tagging its version (`v0.1.0`, the
`version` in `packages/module/static/module.json`); the release workflow
builds and publishes it. Add the release's changes to CHANGELOG.md first.
