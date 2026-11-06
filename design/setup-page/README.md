# Setup page mockup

A clickable mockup of the replacement Setup page. Decisions and open questions:
`docs/SETUP-REDESIGN.md`. Foundry facts behind it: `docs/SETUP-SPIKE.md`.

```sh
./assets.sh            # Foundry's CSS, fonts and images from ~/foundry/vtt into fvtt/ (git-ignored)
node build.mjs         # out/index.html is the playground; out/setup-shell.html the page itself
node checks/run.mjs    # 26 Playwright checks; screenshots go to out/shots/
```

- `src/` — the page: `_data.js` (sample library), `_kit.*` (Foundry card markup), `_shell.*`
  (layout, world page, Library), `_ideas.*` (grid, intake, copy, review at launch),
  `_calm.*` (current cards, header, About, Backups), `_sched.*` (next session), `_server.*` (server backups page), `_tips.js`
  (tooltips), `_news.js`, `_boot.js`.
- `checks/` — one script per flow; each prints what it found.
- `spikes/` — live tests against a running Foundry (`pnpm foundry:start`); run from the repo
  root. `spike-edit.ts` changes and restores one field of the test world; the rest only read.

Prototype code: one global state object and a full re-render on every change. Not a model
for the extension.
