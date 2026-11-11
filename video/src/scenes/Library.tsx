// The Library: its folders scroll by, then one card steps forward to show
// its tag and its note. The list that scrolls is rebuilt from the page's own
// cards and headings; everything else is the page as captured.
import type { FC } from "react";
import { Img, useCurrentFrame } from "remotion";
import { capture, centre, type Rect, shot, SHOTS } from "../data";
import { ease, lerp, pop, pulse, track } from "../motion";
import { Shot, Slice } from "../parts/Shot";
import { Stage } from "../parts/Stage";
import { COLOR, PAGE } from "../theme";

const { cards, folders, chrome } = capture.library;
const LIST = chrome.list;
const { card: HERO, tags: TAGS, note: NOTE } = capture.walk.noted;

const SCROLL_UNTIL = 76;
/** Stops with the second, third and fourth folder heading at the top. */
const STOPS = [1, 2, 3].map((i) => (folders[i]?.rect[1] ?? LIST[1]) - LIST[1]);
const SCROLL = [
  [4, 0],
  [16, STOPS[0] ?? 0],
  [23, STOPS[0] ?? 0],
  [33, STOPS[1] ?? 0],
  [40, STOPS[1] ?? 0],
  [50, STOPS[2] ?? 0],
  [56, STOPS[2] ?? 0],
  [74, 0],
] as const;

const HERO_IN = 78;
const HERO_OUT = 222;
const HERO_SCALE = 2.5;
const HERO_AT = { x: PAGE.width / 2, y: 290 };
const TO_NOTE = 150;

const ScrollingList: FC<{ readonly scroll: number }> = ({ scroll }) => (
  <div
    style={{
      position: "absolute",
      left: LIST[0],
      top: LIST[1],
      width: LIST[2],
      height: LIST[3],
      overflow: "hidden",
    }}
  >
    <Slice
      src={SHOTS.library}
      rect={LIST}
      at={{ x: 0, y: 0 }}
      style={{ filter: "blur(24px) brightness(0.55)", transform: "scale(1.1)" }}
    />
    <div
      style={{ position: "absolute", transform: `translateY(${-scroll}px)` }}
    >
      {[
        ...folders.map((f) => ({ ...f, src: `sh/folders/${f.id}.png` })),
        ...cards.map((c) => ({ ...c, src: `sh/cards/${c.id}.png` })),
      ]
        .filter((p) => Math.abs(p.rect[1] - LIST[1] - scroll) < LIST[3] + 120)
        .map((p) => (
          <Img
            key={p.src}
            src={shot(p.src)}
            style={{
              position: "absolute",
              left: p.rect[0] - LIST[0],
              top: p.rect[1] - LIST[1],
              width: p.rect[2],
              height: p.rect[3],
            }}
          />
        ))}
    </div>
  </div>
);

/** A page rect as the stepped-forward card shows it. */
function onHero(rect: Rect, amount: number): Rect {
  const from = centre(HERO);
  const scale = lerp(1, HERO_SCALE, amount);
  const cx = lerp(from.x, HERO_AT.x, amount);
  const cy = lerp(from.y, HERO_AT.y, amount);
  return [
    cx + (rect[0] - from.x) * scale,
    cy + (rect[1] - from.y) * scale,
    rect[2] * scale,
    rect[3] * scale,
  ];
}

const Ring: FC<{
  readonly rect: Rect;
  readonly opacity: number;
  readonly swell: number;
}> = ({ rect, opacity, swell }) => {
  const pad = 7 + swell * 5;
  return (
    <div
      style={{
        position: "absolute",
        left: rect[0] - pad,
        top: rect[1] - pad,
        width: rect[2] + pad * 2,
        height: rect[3] + pad * 2,
        opacity,
        borderRadius: 9,
        border: `2.5px solid ${COLOR.warm}`,
        boxShadow: `0 0 ${14 + swell * 16}px rgba(238,155,58,0.55)`,
      }}
    />
  );
};

const Hero: FC = () => {
  const frame = useCurrentFrame();
  const amount =
    pop(frame, HERO_IN, 14) * (1 - ease(frame, HERO_OUT, HERO_OUT + 14));
  if (amount <= 0.001) return null;
  const shown = Math.min(1, amount);
  const at = onHero(HERO, amount);
  const toNote = ease(frame, TO_NOTE, TO_NOTE + 12);
  const tags = onHero(TAGS, amount);
  const note = onHero(NOTE, amount);
  const ring: Rect = [
    lerp(tags[0], note[0], toNote),
    lerp(tags[1], note[1], toNote),
    lerp(tags[2], note[2], toNote),
    lerp(tags[3], note[3], toNote),
  ];
  const swell = pulse(frame, HERO_IN + 22, 10) + pulse(frame, TO_NOTE + 14, 10);
  return (
    <>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(8,7,14,0.78)",
          opacity: shown,
        }}
      />
      <Slice
        src={SHOTS.library}
        rect={HERO}
        at={{ x: at[0], y: at[1] }}
        style={{
          transformOrigin: "0 0",
          transform: `scale(${at[2] / HERO[2]})`,
          borderRadius: 4,
          boxShadow: `0 ${10 * shown}px ${40 * shown}px rgba(0,0,0,0.7)`,
        }}
      />
      <Ring
        rect={ring}
        opacity={ease(frame, HERO_IN + 14, HERO_IN + 22) * shown}
        swell={swell}
      />
    </>
  );
};

export const Library: FC = () => {
  const frame = useCurrentFrame();
  return (
    <Stage>
      <Shot src={SHOTS.library} />
      {frame < SCROLL_UNTIL && <ScrollingList scroll={track(frame, SCROLL)} />}
      <Hero />
    </Stage>
  );
};
