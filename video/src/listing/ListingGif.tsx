// A loop made to be a GIF, for the companion's foundryvtt.com page: the real
// Setup pages, cut hard from one to the next, with a pointer walking the
// flow. Only small things move (the pointer, a ring, the caption), so
// most frames cost a GIF almost nothing.
import type { FC } from "react";
import { AbsoluteFill, Img, useCurrentFrame } from "remotion";
import { capture, SHOTS } from "../data";
import { sec, track } from "../motion";
import { COLOR } from "../theme";
import {
  Caption,
  ClickRing,
  Cursor,
  Mark,
  type Box,
  type Point,
} from "./parts";

export const LISTING = { width: 960, height: 600, bar: 60 } as const;

/** Which part of a captured page the picture shows, and how big. */
interface View {
  readonly scale: number;
  readonly x: number;
  readonly y: number;
}

/** The whole page, at the picture's width. */
const WHOLE: View = { scale: LISTING.width / 1280, x: 0, y: 0 };
/** The launch dialog at its own size, centred. */
const DIALOG: View = { scale: 1, x: 160, y: 90 };

interface Scene {
  readonly src: string;
  readonly view: View;
  readonly lead: string;
  readonly rest: string;
  readonly frames: number;
  /** What the ring goes round, in page pixels, and when it shows. */
  readonly mark?: { readonly box: Box; readonly at: number };
  /** Where the pointer goes to click, in page pixels, and when. */
  readonly click: { readonly box: Box; readonly at: number };
}

const W = capture.walk;
const NOTED: Box = W.noted.card;

const SCENES: readonly Scene[] = [
  {
    src: SHOTS.library,
    view: WHOLE,
    lead: "Your modules",
    rest: "in folders, with your notes.",
    frames: sec(3.4),
    mark: { box: NOTED, at: sec(0.5) },
    click: { box: W.world.railItem, at: sec(2.9) },
  },
  {
    src: SHOTS.world,
    view: WHOLE,
    lead: "Each world",
    rest: "has its own page.",
    frames: sec(2.8),
    click: { box: W.world.toggle, at: sec(2.3) },
  },
  {
    src: SHOTS.queued,
    view: WHOLE,
    lead: "Flip a switch.",
    rest: "It waits for launch.",
    frames: sec(3),
    mark: { box: W.queued.waits, at: sec(0.15) },
    click: { box: W.queued.launch, at: sec(2.5) },
  },
  {
    src: SHOTS.review,
    view: DIALOG,
    lead: "Review it,",
    rest: "then launch.",
    frames: sec(3.6),
    mark: { box: W.review.verdict, at: sec(0.3) },
    click: { box: W.review.apply, at: sec(2.6) },
  },
];

export const LISTING_FRAMES = SCENES.reduce((n, s) => n + s.frames, 0);

const toPicture = (v: View, p: Point): Point => ({
  x: (p.x - v.x) * v.scale,
  y: (p.y - v.y) * v.scale,
});

const centreOf = (v: View, b: Box): Point =>
  toPicture(v, { x: b[0] + b[2] / 2, y: b[1] + b[3] / 2 });

const boxIn = (v: View, b: Box): Box => {
  const p = toPicture(v, { x: b[0], y: b[1] });
  return [p.x, p.y, b[2] * v.scale, b[3] * v.scale];
};

/** The scene playing at `frame`, the frame within it, and the one before. */
const sceneAt = (frame: number) => {
  let start = 0;
  for (const [i, s] of SCENES.entries()) {
    if (frame < start + s.frames) {
      const before = SCENES[(i + SCENES.length - 1) % SCENES.length]!;
      return { scene: s, local: frame - start, before };
    }
    start += s.frames;
  }
  const last = SCENES[SCENES.length - 1]!;
  return { scene: last, local: last.frames - 1, before: SCENES[0]! };
};

/** Where the pointer is: it starts where the last click was, then travels. */
const pointer = (scene: Scene, before: Scene, local: number): Point => {
  const from = centreOf(before.view, before.click.box);
  const to = centreOf(scene.view, scene.click.box);
  const leave = scene.click.at - sec(1);
  const arrive = scene.click.at - sec(0.15);
  const keys = (a: number, b: number) =>
    [
      [leave, a],
      [arrive, b],
    ] as const;
  return {
    x: track(local, keys(from.x, to.x)),
    y: track(local, keys(from.y, to.y)),
  };
};

export const ListingGif: FC = () => {
  const frame = useCurrentFrame();
  const { scene, local, before } = sceneAt(frame);
  const v = scene.view;
  const at = pointer(scene, before, local);
  const clickAt = scene.click.at;
  const press = local >= clickAt && local < clickAt + 4 ? 1 : 0;
  const picture = LISTING.height - LISTING.bar;
  return (
    <AbsoluteFill style={{ background: COLOR.bg }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          height: picture,
          overflow: "hidden",
        }}
      >
        <Img
          src={scene.src}
          style={{
            position: "absolute",
            left: -v.x * v.scale,
            top: -v.y * v.scale,
            width: 1280 * v.scale,
            maxWidth: "none",
          }}
        />
        {scene.mark && (
          <Mark
            box={boxIn(v, scene.mark.box)}
            frame={local}
            on={scene.mark.at}
          />
        )}
        <ClickRing at={at} frame={local} on={clickAt} />
        <Cursor at={at} press={press} />
      </div>
      <Caption lead={scene.lead} rest={scene.rest} height={LISTING.bar} />
    </AbsoluteFill>
  );
};
