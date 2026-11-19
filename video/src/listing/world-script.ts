// The in-world GIF's script: the library view in a running world's Module
// Management. Token Magic FX carries the story: found in its folder, its
// note, tag and preset, what it needs, switched on, reviewed, saved.
import { sec } from "../motion";
import type { Box } from "./parts";
import { framesOf, page, type Scene, type View } from "./scene";
import { LISTING } from "./SceneGif";
import { atWorld, WORLD_SCREENS as S } from "./world-shots";

const V = atWorld.view;
const A = atWorld.after;
const PICTURE = { width: LISTING.width, height: LISTING.height - LISTING.bar };

/** A dialog centred in the picture, at its own size if it fits. */
const around = (b: Box): View => {
  const scale = Math.min(1, (PICTURE.height - 20) / b[3]);
  return {
    scale,
    x: b[0] + b[2] / 2 - PICTURE.width / 2 / scale,
    y: b[1] + b[3] / 2 - PICTURE.height / 2 / scale,
  };
};

export const WORLD_SCENES: readonly Scene[] = [
  page(S.settings, "Inside a world,", "open Module Management.", 2.4, {
    click: { box: atWorld.settings.manage, at: sec(1.9) },
  }),
  page(S.cards, "Your library,", "in Foundry's own window.", 3, {
    rings: [{ box: V.head, at: sec(0.4) }],
    click: { box: V.title, at: sec(2.5) },
  }),
  page(S.panel, "Every module's note,", "tags and presets.", 3.6, {
    rings: [
      { box: V.note, at: sec(0.3) },
      { box: V.tag, at: sec(0.9) },
      { box: V.preset, at: sec(1.5) },
    ],
    click: { box: V.packageTab, at: sec(3.1) },
  }),
  page(S.package, "And what it needs.", "", 2.4, {
    rings: [{ box: V.needs, at: sec(0.3) }],
    click: { box: V.toggle, at: sec(1.9) },
  }),
  page(S.changed, "Flip a switch.", "Nothing is saved yet.", 2.6, {
    rings: [{ box: V.pending, at: sec(0.2) }],
    click: { box: V.save, at: sec(2.1) },
  }),
  page(S.review, "Review it,", "with what it needs.", 3.2, {
    view: around(A.dialog),
    rings: [{ box: A.added, at: sec(0.3) }],
    click: { box: A.saveReload, at: sec(2.7) },
  }),
  page(S.after, "The world reloads,", "with it on.", 2.8, {
    rings: [{ box: A.card, at: sec(0.4) }],
  }),
  { kind: "end", lead: "", rest: "", frames: sec(3.4) },
];

export const WORLD_FRAMES = framesOf(WORLD_SCENES);
