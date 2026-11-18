# In-world library mockup

A clickable mockup of Stagehand's library inside a world: the server's
folders, tags and notes in Foundry's own Module Management window, and
Apply Presets with Stagehand's dialogs. Plan and decisions:
`docs/IN-WORLD-LIBRARY-PLAN.md` (issue #2).

```sh
./assets.sh            # Foundry's CSS, textures and fonts from ~/foundry/vtt into fvtt/ (git-ignored)
node build.mjs         # out/index.html is the playground; out/mock.html the game view it frames
node checks/run.mjs    # walks the flows in Chromium and checks what shows; screenshots in out/shots/
```

- `src/mock.html`: a reduced game interface (scene controls, the Game
  Settings tab, the players list) around the window.
- `src/window.js`: Module Management as Foundry 14.370 renders it (markup
  captured from the live window on the private 14 server), plus the
  library: folder groups drawn with Foundry's sidebar folder headers, tags
  and a note icon in each row's tag strip, search over tags and notes, the
  folders/A–Z button beside the expand arrows, Apply Presets in the footer.
- `src/dialogs.js`: choose presets and a mode, then the diff and
  confirmation (the companion's `dialog.ts` sections), drawn as Foundry's
  DialogV2 (markup captured from 14.370).
- `src/plan.js`: a small version of the shared resolver: Add, Replace,
  Remove, required modules come along, Stagehand stays on.
- `src/data.js`: a sample world and library.
- `src/boot.js`: state, Foundry's tooltip and notifications as stand-ins, the
  reload. Query: `lib=0`, `role=gm|assistant|player`, `theme=dark|light`.

Prototype code: one global state object and re-rendering on change. Not a
model for the companion.
