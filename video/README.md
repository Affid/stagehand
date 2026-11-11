# Promo video

Two cuts of a video of Stagehand (1920 x 1080, 30 fps), built in code so
they can be rendered again when the page changes: `Promo`, 41 seconds and
calm, and `PromoB` (src/b), 34 seconds, cut on the beat with big type. It is not part of any shipped
package and has its own install, outside the product's pnpm workspace.

```
capture/   Playwright scripts: the real pages off the demo server, as images and positions
src/       the video (Remotion): scenes, captions, timing
music/     the score and the tools that render it (its own README)
public/    what the video is made from: capture/ (images, capture.json), audio/
out/       renders (ignored by git)
```

## Render

```bash
cd video
pnpm install
pnpm render                                  # out/stagehand-promo.mp4
pnpm render --props='{"music":"synth"}'      # another rendering of the score
pnpm render --props='{"music":"none"}'       # no sound
pnpm still out/thumbnail.png --frame=0
pnpm render:b                                # out/stagehand-promo-b.mp4 (cut B)
pnpm studio                                  # scrub through it in the browser
```

`music` is `sampled` (the default), `synth`, `simple` or `none` (cut B:
`b-sampled`, `b-synth` or `none`); see
[music/README.md](music/README.md) for what each is and how it is made.

## Capture again (after the page changes)

The pictures come from the demo Foundry server (port 30015, data in
`~/foundry/data-demo`), which `scripts/demo/setup-demo.ts` fills with 84
real free modules, three worlds and a sorted library. From the repository
root:

```bash
FOUNDRY_PORT=30015 FOUNDRY_DATA_DIR=~/foundry/data-demo pnpm foundry:start   # in another terminal
FOUNDRY_PORT=30015 FOUNDRY_DATA_DIR=~/foundry/data-demo node scripts/demo/setup-demo.ts
(cd packages/extension && pnpm build:release)
FOUNDRY_PORT=30015 FOUNDRY_DATA_DIR=~/foundry/data-demo node video/capture/capture.ts
```

The capture takes Foundry's own Setup (Modules tab) in a plain Chromium and
Stagehand's Setup with the built extension loaded, both at 1280 x 720: whole
pages at 3x, each module card and folder heading as its own image at 2x, and
where every piece sits (`public/capture/capture.json`). It reaches each
state by the real clicks (By world, a world's page, a switch turned on, the
launch review), then discards the queued change. Nothing is launched.
Foundry's notices and its Featured Content advert are hidden, as in the
store screenshots.

The phone pictures (`public/capture/phone`) are the Android app's own
screenshots from a device. With the emulator running (the device suite's
setup, `tests/android`) and the demo server up:

```bash
(cd packages/extension && pnpm build:release) && node scripts/android/gradle.ts assembleDebug
ST_APP_SERVER=http://10.0.2.2:30015 FOUNDRY_PORT=30015 FOUNDRY_DATA_DIR=~/foundry/data-demo \
  node video/capture/phone.ts
```

It installs the debug app fresh, adds the server on the app's home screen,
logs in and takes the worlds, the Library and one world's page.

To make the demo look different, change `scripts/demo` and capture again;
the pictures are never edited.

## What is staged

Everything on screen is the product as captured, except:

- The scene change (0:02 to 0:08). Foundry's page does not turn into
  Stagehand's on screen. The cards are the real cards of both pages; the
  flight, the turn-over, the board with a folder's colour and name over each
  pile, and the tilt are animation.
- The pointer and its click rings are drawn. Each click it shows was made
  for real during the capture, and the picture after it is the page's real
  state after that click; the short fades between states are animation.
- The Library's scrolling list (0:08 to 0:10) is rebuilt from the page's own
  card and heading images, moved as a scroll would move them.
- The card that steps forward for "Tags" and "Notes", the amber rings and
  the amber bands over the By world columns are emphasis, added.
- Camera moves are crops and zooms of the captured pages.
- The world is not launched: the pointer stops at the apply button. The
  companion's own dialog inside the world is not shown.
- The demo server's worlds, folders, tags and notes are invented for the
  demo; its modules are real ones from Foundry's package list.

Cut B is made from the same captures and stages more:

- Foundry's list rushing past under the opening lines is its real cards,
  laid back and scrolled by the video; the page itself is not shown whole.
- The cards scatter and drop into folder piles as animation, as in the
  first cut.
- The pages appear in tilted, rounded windows the video draws around them,
  scrolled or closed in on by the video. The Library comes from one
  capture in a very tall browser window, so every row is the page's own
  rendering.
- Cards, the queued-change note and the review dialog are cut out of the
  captured pages and shown on their own, enlarged.
- The recap is eight quarter-second crops of the captured pages.
- Panels fly in on ropes from pipe battens and are hauled up again, with a
  canvas sandbag on a pulley going the other way: stage rigging after
  Stagehand's mark, all drawn. There is no
  pointer; a light steps down the worlds in the rail and stops on the one
  the capture really clicked, and the switch flips on its beat to the
  page's real state after the real click.
- The Library's cards are dealt into the panel one by one, and the review's
  rows are covered until their beat. The cards and rows are the page's own.
- The phone is the Android app's own screenshot from the emulator, in a
  phone frame the video draws. The pulse between computer and phone is
  drawn; the library really is kept on the server and read by both.

## Notes

- Remotion is free for individuals and small teams; see its licence before
  using this folder in a company of more than three people.
- The caption typeface is Signika (the Setup page's own text face), loaded
  from Google Fonts at render time.
