// The listing GIF's script, scene by scene: what is on screen, what the
// caption says, what the rings go round and where the pointer clicks.
// Health Estimate carries the story: met in the Library, off in the world,
// switched on, reviewed, applied by the companion.
import { sec } from "../motion";
import type { Box } from "./parts";
import { at, SCREENS } from "./shots";

/** Which part of a captured page the picture shows, and how big. */
export interface View {
  readonly scale: number;
  readonly x: number;
  readonly y: number;
}

export interface Ring {
  readonly box: Box;
  readonly at: number;
}

export interface Scene {
  /** A captured page, the phones, or the closing card. */
  readonly kind: "page" | "phones" | "end";
  readonly src?: string;
  readonly view?: View;
  readonly lead: string;
  readonly rest: string;
  readonly frames: number;
  readonly rings?: readonly Ring[];
  /** Where the pointer clicks, in page pixels, and when. */
  readonly click?: Ring;
}

/** The whole page at the picture's width (960 of 1280). */
export const WHOLE: View = { scale: 0.75, x: 0, y: 0 };
/** The launch dialog at its own size, centred. */
const DIALOG: View = { scale: 1, x: 160, y: 90 };
/** The world's top half, close enough to read the companion's notice. */
const NOTICE: View = { scale: 1.15, x: 222, y: 20 };

const L = at.library;
const W = at.world;

const page = (
  src: string,
  lead: string,
  rest: string,
  seconds: number,
  more: Partial<Scene> = {},
): Scene => ({
  kind: "page",
  src,
  view: WHOLE,
  lead,
  rest,
  frames: sec(seconds),
  ...more,
});

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

export const LISTING_FRAMES = SCENES.reduce((n, s) => n + s.frames, 0);
