# Spike: Stagehand's view inside Module Management

Phase 1 of `docs/IN-WORLD-LIBRARY-PLAN.md`, run 2026-11-18 on the private
Foundry 13.351 (port 30013) and 14.370 (port 30014) servers. Throwaway code.

```sh
node_modules/.bin/vite build -c spikes/in-world-library/vite.config.mjs   # module/ui.js (Preact chunk)
FOUNDRY_PORT=30014 FOUNDRY_DATA_DIR=~/foundry/data-14spike node spikes/in-world-library/run.ts
```

The runner needs the server already running. It links `module/` as
`st-spike-mm`, installs BBMM from its release manifest, runs the checks in
the `stagehand-test` world, then restores the world's module list, shuts
the world down, uninstalls BBMM and removes the link. Screenshots and
`results.json` go to `out/<core>/` (git-ignored).

## What the spike module does

`module/main.js`, on `renderModuleManagement`, for Gamemasters only:
widens the window to 1160 px on its first render, replaces the window's
content with a host, loads `ui.js` (Preact, 14.9 kB, 5.6 kB gzipped) with a
dynamic `import()` and draws cards into it, loads its CSS with a `<link>`
from the module's folder, and adds a capture-phase `submit` listener on the
window that stops Foundry's form handler.

## Results: 17 of 17 on both versions

| Check                                                                | 13.351     | 14.370         |
| -------------------------------------------------------------------- | ---------- | -------------- |
| Our view replaces the window's content; Foundry's header stays       | ok         | ok             |
| The window takes the cards' width (1160 px), also after a re-render  | ok         | ok             |
| Preact loads on demand from the module                               | ok, 107 ms | ok, 136-142 ms |
| Its CSS loads from the module                                        | ok         | ok             |
| A Foundry re-render (`app.render()`) draws our view again            | ok         | ok             |
| The submit guard stops Foundry's save; the world's modules untouched | ok         | ok             |
| The light interface draws the window light                           | ok         | ok             |
| With BBMM (1.5.2): its tooltip on the sidebar button                 | ok         | ok             |
| A plain click opens BBMM's window, not Foundry's                     | ok         | ok             |
| Shift-click opens Foundry's window with our view                     | ok         | ok             |
| BBMM's "BBMM" header button sits beside our view                     | ok         | ok             |
| A player gets Foundry's own list                                     | ok         | ok             |
| No errors from the spike                                             | ok         | ok             |

## Findings for the build

- **Foundry's save is the real danger, and a guard works.** Module
  Management is a form; its handler saves the form's named fields as the
  whole module list (`#onSubmitForm`: `formData.object`). Our view has no
  module checkboxes, so a submit (Enter in a field, a submit button) would
  save an empty list and switch every module off. A capture-phase `submit`
  listener on the window runs before Foundry's and stops it; the spike
  checked it with Foundry's settings write spied on: no write.
- **Hooking the render is enough.** `renderModuleManagement` fires on every
  render; replacing the content each time survives Foundry's re-renders.
  `setPosition({width})` on the first render holds through re-renders.
- **Height:** Foundry sizes this window's height to its content, so with few
  modules it is short. The build sets a height (the mockup's 880 px, within
  the screen).
- **On-demand loading works from a module**: a relative dynamic `import()`
  and a `<link>` built from `import.meta.url`. Players never load either.
- **BBMM** (the installed version was 1.5.2, newer than the 1.4.11 read;
  the button handling is the same): catches the plain click and opens
  `#bbmm-module-manager`; Shift-click reaches Foundry's window, where our
  hook runs; its header button is added to Foundry's header and stays,
  since we leave the header alone. It opens a "Module Changelogs" window on
  first load after an update, which is BBMM's own.
- **Foundry 14's sidebar button** is `button[data-action="openApp"][data-app="modules"]`
  (BBMM matches `data-app="modules"`); the sidebar can start collapsed.
- **13 and 14 behave the same** for everything above.
