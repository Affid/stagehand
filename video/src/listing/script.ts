// The listing GIF's script, scene by scene: what is on screen, what the
// caption says, what the rings go round and where the pointer clicks.
// Health Estimate carries the story: met in the Library, off in the world,
// switched on, reviewed, applied by the companion.
import { sec } from "../motion";
import { framesOf, page, type Scene, type View } from "./scene";
import { at, SCREENS } from "./shots";

/** The launch dialog at its own size, centred. */
const DIALOG: View = { scale: 1, x: 160, y: 90 };
/** The world's top half, close enough to read the companion's notice. */
const NOTICE: View = { scale: 1.15, x: 222, y: 20 };

const L = at.library;
const W = at.world;

export const SCENES: readonly Scene[] = [
  page(SCREENS.library, "A new Setup page,", "with a module library.", 3.2, {
    rings: [{ box: L.folder, at: sec(0.5) }],
    click: { box: L.select, at: sec(2.7) },
  }),
  page(SCREENS.tags, "Folders and tags,", "your way.", 2.8, {
    rings: [{ box: L.tag, at: sec(0.3) }],
    click: { box: L.title, at: sec(2.3) },
  }),
  page(SCREENS.panel, "A note on every module,", "and where it's on.", 3.4, {
    rings: [
      { box: L.note, at: sec(0.3) },
      { box: L.worlds, at: sec(1.2) },
    ],
    click: { box: W.railItem, at: sec(2.9) },
  }),
  page(SCREENS.world, "Each world", "has its own page.", 2.4, {
    click: { box: W.onButton, at: sec(1.9) },
  }),
  page(SCREENS.worldOn, "What's on", "in this world, at a glance.", 2.8, {
    click: { box: W.allButton, at: sec(2.3) },
  }),
  page(SCREENS.world, "Flip a switch.", "It waits for launch.", 1.4, {
    click: { box: W.toggle, at: sec(1) },
  }),
  page(SCREENS.queued, "Flip a switch.", "It waits for launch.", 2.6, {
    rings: [{ box: W.waits, at: sec(0.15) }],
    click: { box: W.launch, at: sec(2.1) },
  }),
  page(SCREENS.review, "Review it,", "with a backup first.", 3.2, {
    view: DIALOG,
    rings: [{ box: W.verdict, at: sec(0.3) }],
    click: { box: W.apply, at: sec(2.7) },
  }),
  page(SCREENS.inWorld, "The companion", "applies it in the world.", 3.2, {
    view: NOTICE,
    rings: [{ box: at.game.notice, at: sec(0.4) }],
  }),
  page(SCREENS.backups, "Backups,", "", 1.8),
  page(SCREENS.update, "Foundry updates,", "", 1.8),
  page(SCREENS.config, "and configuration.", "", 1.8),
  {
    kind: "phones",
    lead: "And on your phone.",
    rest: "",
    frames: sec(2.8),
  },
  { kind: "end", lead: "", rest: "", frames: sec(3.4) },
];

export const LISTING_FRAMES = framesOf(SCENES);
