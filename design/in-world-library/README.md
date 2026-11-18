# In-world library mockup

A clickable mockup of Stagehand's library inside a world: Setup's world
page (cards in folder sections, the module panel, presets) inside Foundry's
own Module Management window; a Stagehand setting turns it off. Plan and decisions:
`docs/IN-WORLD-LIBRARY-PLAN.md` (issue #2).

```sh
./assets.sh            # Foundry's CSS, textures and fonts from ~/foundry/vtt into fvtt/ (git-ignored)
node build.mjs         # out/index.html is the playground; out/mock.html the game view it frames
node checks/run.mjs    # walks the flows in Chromium and checks what shows; screenshots in out/shots/
```

- `src/mock.html`: a reduced game interface (scene controls, the Game
  Settings tab, the players list) around the window.
- `src/window.js`: Module Management as Foundry 14.370 renders it (frame and
  list markup captured from the live window on the private 14 server), the
  Foundry's own list when the setting is off, and the actions.
- `src/cards.js`, `src/cards.css`: Setup's world page, Modules tab, inside
  the window: folder sections of cards with switches, All / On / Changes,
  Group by, Apply preset, the pending line, the module panel (Library and
  Package).
  Markup and CSS from the Setup mockup (`../setup-page/src/_calm.*`,
  `_shell.*`, `_kit.css`), limited to `#module-management`.
- `src/settings.js`: Foundry's Configure Settings window (category browser)
  with Stagehand's setting, "Show the Stagehand library in Module
  Management".
- `src/bbmm.js`: BBMM in the same world, as its source does it (its window
  stand-in, Shift-click, its tooltip and header button, its setting), and
  Stagehand's one-time question about which view Module Management opens.
- `src/dialogs.js`: Apply preset (marks its changes on the cards) and the
  review before saving, drawn as Foundry's DialogV2 (markup captured from
  14.370).
- `src/plan.js`: a small version of the shared resolver: Add, Replace,
  Remove, required modules come along, switched-off modules stay off,
  Stagehand stays on.
- `src/data.js`: a sample world and library.
- `src/boot.js`: state, Foundry's tooltip and notifications as stand-ins, the
  reload. Query: `lib=0`, `role=gm|assistant|player`, `theme=dark|light`,
  `bbmm=1`.

Prototype code: one global state object and re-rendering on change. Not a
model for the companion.
