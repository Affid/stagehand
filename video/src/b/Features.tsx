// Bars 5 to 8: the Library and the By world table, each as the real page in
// a floating window that scrolls a step per beat, with one word per beat.
import type { FC } from "react";
import { AbsoluteFill, Img, useCurrentFrame } from "remotion";
import { capture, shot } from "../data";
import { lerp } from "../motion";
import { COLOR } from "../theme";
import { Backdrop, BEAT, BigType, hit, rush, snap, Window } from "./kit";

const TALL_LIBRARY = shot("sh/library-tall.png");
const TALL_TABLE = shot("sh/by-world-tall.png");
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

const HEROES = [
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

// ---- By world ----

const { columns } = capture.walk.byWorld;
const TABLE_VIEW = { x: 290, w: 545, h: 520 } as const;
const TABLE_WIDTH = 920;
const TABLE_SCALE = TABLE_WIDTH / TABLE_VIEW.w;

const WORLD_WORDS = ["Every world.", "Every module.", "One table."] as const;

export const ByWorldB: FC = () => {
  const frame = useCurrentFrame();
  const y = stepped(frame, [150, 150, 980, 2060]);
  return (
    <AbsoluteFill>
      <Backdrop />
      <Window
        src={TALL_TABLE}
        view={{ ...TABLE_VIEW, y }}
        width={TABLE_WIDTH}
        style={{
          left: 110,
          top: 110,
          opacity: presence(frame),
          transform: tilt(frame, 1),
        }}
      >
        {columns.map((column, i) => (
          <div
            key={column[0]}
            style={{
              position: "absolute",
              left: (column[0] - TABLE_VIEW.x + 6) * TABLE_SCALE,
              top: 0,
              bottom: 0,
              width: (column[2] - 12) * TABLE_SCALE,
              background: COLOR.warm,
              opacity: 0.3 * hit(frame, BAR * 3 + i * 7.5, 16),
            }}
          />
        ))}
      </Window>
      {WORLD_WORDS.map((text, i) => (
        <BigType
          key={text}
          line={{
            text,
            at: i * BAR,
            until: i === 2 ? LEAVE + 4 : (i + 1) * BAR,
            accent: ["table"],
          }}
          size={160}
          style={{ left: 1110, top: 360, width: 760 }}
        />
      ))}
    </AbsoluteFill>
  );
};
