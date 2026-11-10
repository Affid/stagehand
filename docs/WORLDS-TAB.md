# Game Worlds tab

Date: 2026-11-05. Replaces the first M1 worlds panel, which listed every world a
second time above Foundry's own cards. Chosen from three mockups (direction C);
the owner asked for it to feel native to Foundry rather than added on.

## What it is

Foundry's world list stays the only list. Stagehand adds:

| Piece                             | Where                        | Built from Foundry's own                                                                    |
| --------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------- |
| Status tag                        | First tag on each world card | `.tag` style and `data-tooltip` tooltips                                                    |
| Menu entries                      | Right-click on a world card  | `ContextMenu`, next to Launch, Edit and Backups                                             |
| "Next launch" strip               | Above the world list         | Panel and button styles                                                                     |
| World sheet, Apply, preset editor | Windows                      | `ApplicationV2` frames: title bar, drag, resize, close                                      |
| Messages                          | Top of the screen            | `ui.notifications`                                                                          |
| Launch world                      | Sheet footer                 | Clicks the card's own launch control, so migration prompts, backups and locks work as usual |

- **Tag:** "n queued", "Failed", "Outdated", "Out of date", "Not tracked", or
  the number of active modules. Always an icon and a word, never colour alone.
  Clicking it opens the sheet; it never launches the world.
- **Strip:** only worlds with queued changes, each with its combined effect
  ("+2 enable, 1 dependency, 1 to check") and Review. A "needs attention" menu
  lists worlds that are not tracked, out of date, outdated or whose last change
  failed. With no tracked world it is a three-step setup guide.
- **Sheet:** status, the ordered queue with Cancel per change, the result after
  the next launch, history, New preset from world, Launch world, Apply presets.
- **Apply dialog:** presets (with a filter), mode as cards, and on the right
  what the next launch will change: "1 → 3 active modules", problems first,
  then enable, dependencies and disable by title. It includes changes already
  queued for that world (P-6); before, the preview ignored them.

## How it hooks into Foundry

The UI runs in the extension's isolated world; Foundry's classes live in the
page's world. `setup-main` (page world) lends them over `window.postMessage`:

- `WINDOW_OPEN` / `WINDOW_CLOSE` / `WINDOW_READY` / `WINDOW_CLOSED`: an
  `ApplicationV2` subclass that renders nothing but an empty host element; the
  UI renders into it with a Preact portal (`FoundryWindow`). If no window is
  ready within 1.5 s, the UI uses its own modal instead.
- `MENU` / `MENU_ACTION` (removed in Phase 5b with the old Game Worlds UI):
  Setup builds the package menu without a hook, so `ContextMenu.prototype.render`
  was wrapped once to add entries on world cards.
- `NOTIFY`: text is escaped with `foundry.utils.escapeHTML`, since Foundry
  renders notification HTML.

Every message is checked by hand on both sides (`src/page-protocol.ts`). The
UI renders only into a host inside an `.application.st-window`.

## Fragility

- Tags are re-applied whenever Foundry re-renders Setup (`renderSetupPackages`
  fires on view-mode changes too). If Foundry's card markup changes, only the
  tag goes missing; the strip, menu and sheet still reach every world. The tag
  container is a remote-config selector (`worldTags`).
- The menu wrapper catches its own errors, so Foundry's entries always render.
- Verified on V14 build 369 in all three Foundry view modes.

## Reviews

A code review and a security review ran on this change; neither found a
CRITICAL or HIGH issue. Fixed, each with a test:

- World-reported error text was shown through Foundry's HTML tooltip path; tags
  now use `data-tooltip-text` (plain text) and cut errors to 300 characters.
- Queued changes whose preset was deleted fail at launch; the preview now leaves
  them out and says so, and the sheet flags them.
- A double click on "Queue for next launch" queued twice.
- Closing a window while Foundry was still rendering it could leave it on
  screen; closing now waits for the render.
- A Foundry window arriving after our fallback modal replaced it and lost the
  form; it is now closed instead.
- Long messages were dropped instead of cut; menu entries could linger on other
  menus; menu actions for unknown worlds were followed; window host ids were
  predictable (now carry a per-page random part); the menu's state marker was a
  global symbol (now private); the attention menu didn't close on Escape or an
  outside click; an outdated companion is now shown before "queued".
