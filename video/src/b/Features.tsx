// Bars 5, 6, 9 and 10: the Library, then one world's own page. Each panel
// flies in on ropes and its contents arrive piece by piece: the Library's
// cards are dealt in, the world is picked from the rail.
import type { FC } from "react";
import { AbsoluteFill, Img, useCurrentFrame } from "remotion";
import { capture, type Piece, shot, SHOTS } from "../data";
import { lerp } from "../motion";
import { COLOR } from "../theme";
import {
  Backdrop,
  BEAT,
  BigType,
  Burst,
  hit,
  rush,
  snap,
  type View,
  Window,
} from "./kit";
import { Hung, ONE } from "./rig";
import { HAUL } from "./timeline";

const BAR = BEAT * 2;

// ---- Library ----

const { cards, folders, chrome } = capture.library;
const LIST = chrome.list;
const MAIN = chrome.main;
/** The panel shows the page from its tabs down, at this width. */
const PANEL = { left: 770, top: 150, width: 990, height: 850 } as const;
const SCALE = PANEL.width / (MAIN[2] + 10);
const HEAD: View = {
  x: MAIN[0],
  y: MAIN[1],
  w: MAIN[2] + 10,
  h: LIST[1] - MAIN[1],
};
const DEAL_FROM = 10;
const DEAL_STEP = 1.3;
/** List positions shown, a step per bar: top, top, Effects, Maps and scenes. */
const STOPS = [0, 0, 1, 2].map(
  (i) => (folders[i]?.rect[1] ?? LIST[1]) - LIST[1],
);

const scrollAt = (frame: number): number =>
  STOPS.reduce(
    (y, stop, i) => (i === 0 ? stop : lerp(y, stop, snap(frame, i * BAR, 16))),
    0,
  );

const pieces: readonly (Piece & { readonly src: string })[] = [
  ...folders.map((f) => ({ ...f, src: `sh/folders/${f.id}.png` })),
  ...cards.map((c) => ({ ...c, src: `sh/cards/${c.id}.png` })),
].sort((a, b) => a.rect[1] - b.rect[1] || a.rect[0] - b.rect[0]);

/** A card or heading sliding into its place, in its turn. */
const Dealt: FC<{
  readonly piece: (typeof pieces)[number];
  readonly turn: number;
}> = ({ piece, turn }) => {
  const frame = useCurrentFrame();
  const t = snap(frame, DEAL_FROM + turn * DEAL_STEP, 9);
  if (t <= 0) return null;
  return (
    <Img
      src={shot(piece.src)}
      style={{
        position: "absolute",
        left: (piece.rect[0] - HEAD.x) * SCALE,
        top: (piece.rect[1] - LIST[1]) * SCALE,
        width: piece.rect[2] * SCALE,
        height: piece.rect[3] * SCALE,
        opacity: t,
        transform: `translate(${lerp(90, 0, t)}px, ${lerp(150, 0, t)}px) rotate(${lerp(9, 0, t)}deg) scale(${lerp(0.82, 1, t)})`,
      }}
    />
  );
};

const BuiltLibrary: FC = () => {
  const frame = useCurrentFrame();
  const scroll = scrollAt(frame);
  const headHeight = HEAD.h * SCALE;
  const shown = pieces.filter(
    (p) => Math.abs(p.rect[1] - LIST[1] - scroll) < PANEL.height / SCALE + 120,
  );
  return (
    <div
      style={{
        position: "relative",
        width: PANEL.width,
        height: PANEL.height,
        overflow: "hidden",
        borderRadius: 22,
        background: "#0e0c15",
        boxShadow:
          "0 50px 120px rgba(0,0,0,0.65), 0 0 0 1.5px rgba(239,233,221,0.14)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: headHeight,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            transform: `translateY(${-scroll * SCALE}px)`,
          }}
        >
          {shown.map((piece) => (
            <Dealt key={piece.src} piece={piece} turn={pieces.indexOf(piece)} />
          ))}
        </div>
      </div>
      <Window
        src={SHOTS.library}
        view={HEAD}
        width={PANEL.width}
        style={{ left: 0, top: 0, borderRadius: 0, boxShadow: "none" }}
      />
    </div>
  );
};

/** Where a card's tag row and note sit inside it, from the captured card. */
const { card: NOTED, tags: TAGS, note: NOTE } = capture.walk.noted;
const INSIDE = {
  tags: [TAGS[0] - NOTED[0], TAGS[1] - NOTED[1], 104, TAGS[3]],
  note: [NOTE[0] - NOTED[0], NOTE[1] - NOTED[1], NOTE[2], NOTE[3]],
} as const;
const CARD_WIDTH = 820;
const CARD_SCALE = CARD_WIDTH / NOTED[2];

const HEROES = [
  { id: "dice-so-nice", at: BAR, x: 850, y: 330, turn: -4, ring: "tags" },
  { id: "polyglot", at: BAR * 2, x: 920, y: 520, turn: 3, ring: "note" },
  { id: "fxmaster", at: BAR * 3, x: 830, y: 720, turn: -2, ring: null },
] as const;

const HeroCard: FC<{ readonly hero: (typeof HEROES)[number] }> = ({ hero }) => {
  const frame = useCurrentFrame();
  const t = snap(frame, hero.at, 11);
  if (t <= 0) return null;
  const ring = hero.ring ? INSIDE[hero.ring] : null;
  return (
    <div
      style={{
        position: "absolute",
        left: hero.x,
        top: hero.y,
        opacity: Math.min(1, t * 3) * (1 - rush(frame, HAUL, 6)),
        transform: `translateY(${lerp(160, 0, t)}px) rotate(${hero.turn}deg) scale(${lerp(0.6, 1, t) + 0.05 * hit(frame, hero.at, 10)})`,
      }}
    >
      <Img
        src={shot(`sh/cards/${hero.id}.png`)}
        style={{
          display: "block",
          width: CARD_WIDTH,
          borderRadius: 12,
          boxShadow:
            "0 40px 90px rgba(0,0,0,0.75), 0 0 0 1.5px rgba(239,233,221,0.16)",
        }}
      />
      {ring && (
        <div
          style={{
            position: "absolute",
            left: ring[0] * CARD_SCALE - 12,
            top: ring[1] * CARD_SCALE - 10,
            width: ring[2] * CARD_SCALE + 24,
            height: ring[3] * CARD_SCALE + 20,
            borderRadius: 18,
            border: `5px solid ${COLOR.warm}`,
            boxShadow: "0 0 34px rgba(238,155,58,0.6)",
            opacity: snap(frame, hero.at + 5, 8),
          }}
        />
      )}
    </div>
  );
};

const LIBRARY_WORDS = [
  "Folders.",
  "Tags.",
  "Notes.",
  "On every module.",
] as const;

export const LibraryB: FC = () => (
  <AbsoluteFill>
    <Backdrop />
    <Hung inAt={0} left={PANEL.left} top={PANEL.top} width={PANEL.width}>
      <BuiltLibrary />
    </Hung>
    {HEROES.map((hero) => (
      <HeroCard key={hero.id} hero={hero} />
    ))}
    {LIBRARY_WORDS.map((text, i) => (
      <BigType
        key={text}
        line={{
          text,
          at: i * BAR,
          until: i === 3 ? HAUL + 4 : (i + 1) * BAR,
          accent: ["every"],
        }}
        size={i === 3 ? 150 : 210}
        style={{ left: 110, top: i === 3 ? 380 : 420, width: 640 }}
      />
    ))}
  </AbsoluteFill>
);

// ---- A world ----

const RAIL = chrome.worlds;
const PICK = capture.walk.world.railItem;
const SWITCHED = capture.walk.world.card;
/** The three worlds in the rail, without the empty room under them. */
const RAIL_VIEW: View = { x: RAIL[0], y: RAIL[1], w: RAIL[2], h: 190 };
const RAIL_AT = { left: 600, top: 190, width: 620 } as const;
const RAIL_SCALE = RAIL_AT.width / RAIL_VIEW.w;
const ROW = 66 * RAIL_SCALE;
const PICKED_TOP = (PICK[1] - RAIL_VIEW.y) * RAIL_SCALE;
/** A light steps down the worlds and stops on the third: the pick. */
const STEPS = [8, 17, 26] as const;
const CLICK = STEPS[2];
const PAGE_IN = BAR;
const WHOLE: View = { x: MAIN[0], y: MAIN[1], w: MAIN[2], h: MAIN[3] };
/** The same shape, closed in on the card the next scene switches on. */
const CLOSE: View = {
  x: SWITCHED[0] + SWITCHED[2] / 2 - 300,
  y: SWITCHED[1] + SWITCHED[3] / 2 - 300 * (MAIN[3] / MAIN[2]),
  w: 600,
  h: 600 * (MAIN[3] / MAIN[2]),
};

const Stepper: FC = () => {
  const frame = useCurrentFrame();
  const step = STEPS.filter((s) => frame >= s).length - 1;
  if (step < 0) return null;
  const top = PICKED_TOP - (2 - step) * ROW;
  return (
    <div
      style={{
        position: "absolute",
        left: 6,
        top: top + 2,
        width: RAIL_AT.width - 12,
        height: PICK[3] * RAIL_SCALE - 4,
        borderRadius: 12,
        border: `4px solid ${COLOR.warm}`,
        boxShadow: "0 0 30px rgba(238,155,58,0.55)",
        transform: `scale(${1 + 0.05 * hit(frame, STEPS[step] ?? 0, 8)})`,
      }}
    />
  );
};

export const WorldB: FC = () => {
  const frame = useCurrentFrame();
  const close = snap(frame, BAR * 2, 50);
  return (
    <AbsoluteFill>
      <Backdrop />
      <Hung
        inAt={0}
        outAt={PAGE_IN - 2}
        left={RAIL_AT.left}
        top={RAIL_AT.top}
        width={RAIL_AT.width}
        ropes={ONE}
      >
        <Window
          src={SHOTS.library}
          view={RAIL_VIEW}
          width={RAIL_AT.width}
          style={{ position: "relative" }}
        >
          <Stepper />
        </Window>
      </Hung>
      <Burst
        x={RAIL_AT.left + RAIL_AT.width / 2}
        y={RAIL_AT.top + PICKED_TOP + ROW / 2}
        amount={(frame - CLICK) / 14}
        size={620}
      />
      <Hung inAt={PAGE_IN} left={700} top={190} width={1060}>
        <Window
          src={SHOTS.world}
          view={{
            x: lerp(WHOLE.x, CLOSE.x, close),
            y: lerp(WHOLE.y, CLOSE.y, close),
            w: lerp(WHOLE.w, CLOSE.w, close),
            h: lerp(WHOLE.h, CLOSE.h, close),
          }}
          width={1060}
          style={{ position: "relative" }}
        />
      </Hung>
      <BigType
        line={{
          text: "Pick a world.",
          at: 0,
          until: PAGE_IN,
          accent: ["world"],
        }}
        size={190}
        style={{ left: 110, top: 790 }}
      />
      <BigType
        line={{
          text: "Its own modules.",
          at: PAGE_IN,
          until: HAUL + 4,
          accent: ["own"],
        }}
        size={150}
        style={{ left: 110, top: 380, width: 560 }}
      />
    </AbsoluteFill>
  );
};
