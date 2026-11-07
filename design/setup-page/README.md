# Setup page mockup

A clickable mockup of the replacement Setup page. Decisions and open questions:
`docs/SETUP-REDESIGN.md`. Foundry facts behind it: `docs/SETUP-SPIKE.md`.

```sh
./assets.sh            # Foundry's CSS, fonts and images from ~/foundry/vtt into fvtt/ (git-ignored)
node build.mjs         # out/index.html is the playground; out/phone.html the phone playground; out/setup-shell.html the page itself
node checks/run.mjs    # 40 Playwright checks; screenshots go to out/shots/
```

- `src/` — the page: `_data.js` (sample library), `_kit.*` (Foundry card markup), `_shell.*`
  (layout, world page, Library), `_ideas.*` (grid, intake, copy, review at launch),
  `_calm.*` (current cards, header, About, Backups), `_sched.*` (next session), `_server.*` (server backups page), `_config.*` (Configuration page), `_update.*` (update and release notes), `_tips.js`
  (tooltips), `_news.js`, `_phone.*` (the phone layout, `?phone=1`, the "tabs" layout the owner
  chose; Android app phase 1), `_boot.js`.
- `phone.html` — the phone playground: the new page or Foundry's, small phone, phone or tablet, and Foundry's own
  page today (`out/today.jpg`, made by `node scripts/dev/phone-today.ts` from the repo root while
  Foundry runs; copied by the build when present).
- `tools/` — `look.mjs` (a screenshot at any size after some clicks) and `sheet.mjs` (screenshots side
  by side).
- `checks/` — one script per flow; each prints what it found.
- `spikes/` — live tests against a running Foundry (`pnpm foundry:start`); run from the repo
  root. `spike-edit.ts` changes and restores one field of the test world; `spike-snapshot.ts` creates
  one snapshot and deletes it again (never restores); the rest only read.

Prototype code: one global state object and a full re-render on every change. Not a model
for the extension.
