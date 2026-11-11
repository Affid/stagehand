// Bars 5 to 8: the Library, then one world's own page, each as the real
// page in a floating window, with one line per beat or two.
import type { FC } from "react";
import { AbsoluteFill, Img, useCurrentFrame } from "remotion";
import { capture, shot, SHOTS } from "../data";
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

const TALL_LIBRARY = shot("sh/library-tall.png");
const BAR = BEAT * 2;
const LEAVE = 113;

/** A value that jumps to the next stop at the start of each bar-half. */
function stepped(frame: number, stops: readonly number[]): number {
  return stops.reduce(
    (value, stop, i) =>
      i === 0 ? stop : lerp(value, stop, snap(frame, i * BAR, 16)),
    0,
  );
}

const tilt = (frame: number, side: 1 | -1): string => {
  const enter = snap(frame, 0, 16);
  const leave = rush(frame, LEAVE, 7);
  const sway = Math.sin(frame / 40) * 2;
  return `perspective(2200px) rotateY(${side * (14 + sway)}deg) rotateX(4deg) scale(${lerp(1.5, 1, enter) + leave * 0.5})`;
};

const presence = (frame: number): number =>
  snap(frame, 0, 8) * (1 - rush(frame, LEAVE, 7));

// ---- Library ----

/** Where a card's tag row and note sit inside it, from the captured card. */
const { card: NOTED, tags: TAGS, note: NOTE } = capture.walk.noted;
const INSIDE = {
  tags: [TAGS[0] - NOTED[0], TAGS[1] - NOTED[1], 104, TAGS[3]],
  note: [NOTE[0] - NOTED[0], NOTE[1] - NOTED[1], NOTE[2], NOTE[3]],
} as const;
const CARD_WIDTH = 820;
const CARD_SCALE = CARD_WIDTH / NOTED[2];

export const HEROES = [
  { id: "dice-so-nice", at: BAR, x: 900, y: 330, turn: -4, ring: "tags" },
  { id: "polyglot", at: BAR * 2, x: 990, y: 520, turn: 3, ring: "note" },
  { id: "fxmaster", at: BAR * 3, x: 860, y: 720, turn: -2, ring: null },
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
        opacity: Math.min(1, t * 3) * (1 - rush(frame, LEAVE, 6)),
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
  { text: "Folders.", accent: [] },
  { text: "Tags.", accent: [] },
  { text: "Notes.", accent: [] },
  { text: "On every module.", accent: ["every"] },
] as const;

export const LibraryB: FC = () => {
  const frame = useCurrentFrame();
  const y = stepped(frame, [60, 200, 760, 1090]);
  return (
    <AbsoluteFill>
      <Backdrop />
      <Window
        src={TALL_LIBRARY}
        view={{ x: 280, y, w: 990, h: 850 }}
        width={1040}
        style={{
          left: 800,
          top: 96,
          opacity: presence(frame),
          transform: tilt(frame, -1),
        }}
      />
      {HEROES.map((hero) => (
        <HeroCard key={hero.id} hero={hero} />
      ))}
      {LIBRARY_WORDS.map((word, i) => (
        <BigType
          key={word.text}
          line={{
            text: word.text,
            at: i * BAR,
            until: i === 3 ? LEAVE + 4 : (i + 1) * BAR,
            accent: word.accent,
          }}
          size={i === 3 ? 150 : 210}
          style={{ left: 110, top: i === 3 ? 380 : 420, width: 700 }}
        />
      ))}
    </AbsoluteFill>
  );
};

// ---- A world ----

const RAIL = capture.library.chrome.worlds;
const PICK = capture.walk.world.railItem;
const MAIN = capture.library.chrome.main;
const SWITCHED = capture.walk.world.card;
/** The three worlds in the rail, without the empty room under them. */
const RAIL_VIEW: View = { x: RAIL[0], y: RAIL[1], w: RAIL[2], h: 190 };
export const RAIL_AT = { left: 130, top: 320, width: 580 } as const;
export const RAIL_SCALE = RAIL_AT.width / RAIL_VIEW.w;
export const PICKED = {
  x: RAIL_AT.left + (PICK[0] + PICK[2] * 0.6 - RAIL_VIEW.x) * RAIL_SCALE,
  y: RAIL_AT.top + (PICK[1] + PICK[3] / 2 - RAIL_VIEW.y) * RAIL_SCALE,
} as const;
export const CLICK = 26;
const PAGE_IN = BAR;
const WHOLE: View = { x: MAIN[0], y: MAIN[1], w: MAIN[2], h: MAIN[3] };
/** The same shape, closed in on the card the next scene switches on. */
const CLOSE: View = {
  x: SWITCHED[0] + SWITCHED[2] / 2 - 300,
  y: SWITCHED[1] + SWITCHED[3] / 2 - 300 * (MAIN[3] / MAIN[2]),
  w: 600,
  h: 600 * (MAIN[3] / MAIN[2]),
};

/** One world picked in the rail, then its own page: the way into a change. */
export const WorldB: FC = () => {
  const frame = useCurrentFrame();
  const railGone = rush(frame, PAGE_IN, 8);
  const page = snap(frame, PAGE_IN, 14);
  const close = snap(frame, BAR * 2, 50);
  const leave = rush(frame, LEAVE, 7);
  return (
    <AbsoluteFill>
      <Backdrop />
      <Window
        src={SHOTS.library}
        view={RAIL_VIEW}
        width={RAIL_AT.width}
        style={{
          left: RAIL_AT.left - railGone * 200,
          top: RAIL_AT.top,
          opacity: snap(frame, 0, 8) * (1 - railGone),
          transform: `scale(${lerp(1.3, 1, snap(frame, 0, 14)) + 0.04 * hit(frame, CLICK, 9)})`,
        }}
      />
      <Burst
        x={PICKED.x}
        y={PICKED.y}
        amount={(frame - CLICK) / 14}
        size={420}
      />
      <Window
        src={SHOTS.world}
        view={{
          x: lerp(WHOLE.x, CLOSE.x, close),
          y: lerp(WHOLE.y, CLOSE.y, close),
          w: lerp(WHOLE.w, CLOSE.w, close),
          h: lerp(WHOLE.h, CLOSE.h, close),
        }}
        width={1080}
        style={{
          left: 760,
          top: 180,
          opacity: page * (1 - leave),
          transform: `perspective(2200px) rotateY(${-12 * (1 - close * 0.6)}deg) rotateX(3deg) scale(${lerp(1.4, 1, page) + leave * 0.5})`,
        }}
      />
      <BigType
        line={{
          text: "Pick a world.",
          at: 0,
          until: PAGE_IN,
          accent: ["world"],
        }}
        size={190}
        style={{ left: 820, top: 420 }}
      />
      <BigType
        line={{
          text: "Its own modules.",
          at: PAGE_IN,
          until: LEAVE + 4,
          accent: ["own"],
        }}
        size={150}
        style={{ left: 110, top: 360, width: 620 }}
      />
    </AbsoluteFill>
  );
};
