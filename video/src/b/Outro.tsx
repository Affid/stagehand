// The last bars: four looks back at the real pages, each gliding in from a
// side on the beat, then the name.
import type { FC } from "react";
import { AbsoluteFill, Img, useCurrentFrame } from "remotion";
import { shot, SHOTS } from "../data";
import { lerp } from "../motion";
import { Mark } from "../scenes/EndCard";
import { COLOR, fontFamily } from "../theme";
import { Backdrop, Burst, hit, snap, type View } from "./kit";
import { BagIntoMark } from "./rig";

const FULL: View = { x: 0, y: 0, w: 1280, h: 720 };
/** Half a second each, on the beat: four looks, not eight. */
const FLASH = 15;
const LOOKS: readonly { readonly src: string; readonly view: View }[] = [
  { src: SHOTS.library, view: FULL },
  { src: SHOTS.world, view: FULL },
  { src: SHOTS.queued, view: { x: 270, y: 60, w: 1000, h: 562.5 } },
  { src: SHOTS.review, view: { x: 220, y: 130, w: 840, h: 472.5 } },
];
/** How far a look travels as it arrives: a short glide, not a whip. */
const GLIDE = 420;

export type RecapProps = {
  /** Frames each look holds; the video's recap uses half a second. */
  readonly hold?: number;
  /** The first look glides in over the last, so the recap can loop. */
  readonly loop?: boolean;
};

export const Recap: FC<RecapProps> = ({ hold = FLASH, loop = false }) => {
  const frame = useCurrentFrame();
  const index = Math.min(LOOKS.length - 1, Math.floor(frame / hold));
  const look = LOOKS[index];
  if (!look) return null;
  const arrive = snap(frame, index * hold, 12);
  const side = index % 2 === 0 ? 1 : -1;
  const before =
    index === 0 && loop ? LOOKS[LOOKS.length - 1] : LOOKS[index - 1];
  const flat = (
    shown: (typeof LOOKS)[number],
    shift: number,
    opacity: number,
  ) => {
    const s = 1920 / shown.view.w;
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          opacity,
          transform: `translateX(${shift}px)`,
          boxShadow: "0 0 60px rgba(0,0,0,0.8)",
        }}
      >
        <Img
          src={shown.src}
          style={{
            position: "absolute",
            left: -shown.view.x * s,
            top: -shown.view.y * s,
            width: 1280 * s,
            maxWidth: "none",
          }}
        />
      </div>
    );
  };
  return (
    <AbsoluteFill style={{ background: COLOR.bg, overflow: "hidden" }}>
      {before && flat(before, 0, 1)}
      {flat(look, side * (1 - arrive) * GLIDE, arrive)}
    </AbsoluteFill>
  );
};

const LINE_STYLE = {
  position: "absolute",
  left: 0,
  right: 0,
  textAlign: "center",
  lineHeight: 1.1,
} as const;

const NAME = "Stagehand";
const LINE = "Module management doesn't have to be tedious.";
const FOOT =
  "github.com/Affid/stagehand  ·  Not affiliated with Foundry Gaming LLC";

const MARK_AT = { left: 845, top: 150 } as const;

export const Lockup: FC = () => {
  const frame = useCurrentFrame();
  const mark = snap(frame, 0, 12);
  const rise = (at: number): number => snap(frame, at, 10);
  return (
    <AbsoluteFill style={{ fontFamily, color: COLOR.fg }}>
      <Backdrop />
      <Burst x={960} y={MARK_AT.top + 115} amount={frame / 24} size={1000} />
      <div
        style={{
          position: "absolute",
          ...MARK_AT,
          transform: `scale(${lerp(2.2, 1, mark)})`,
          opacity: mark,
        }}
      >
        <Mark frame={999} withoutBag />
      </div>
      <BagIntoMark at={2} markLeft={MARK_AT.left} markTop={MARK_AT.top} />
      <div style={{ ...LINE_STYLE, top: 400, fontSize: 190, fontWeight: 600 }}>
        {[...NAME].map((letter, i) => {
          const t = rise(6 + i * 1.2);
          return (
            <span
              key={`${letter}-${i}`}
              style={{
                display: "inline-block",
                opacity: t,
                transform: `translateY(${lerp(90, 0, t)}px) scale(${lerp(1.3, 1, t)})`,
              }}
            >
              {letter}
            </span>
          );
        })}
      </div>
      <div style={{ ...LINE_STYLE, top: 640, fontSize: 60, fontWeight: 500 }}>
        {LINE.split(" ").map((word, i) => {
          const t = rise(26 + i * 2.2);
          return (
            <span
              key={`${word}-${i}`}
              style={{
                display: "inline-block",
                marginRight: "0.27em",
                opacity: t,
                transform: `translateY(${lerp(30, 0, t)}px)`,
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
      <div
        style={{
          ...LINE_STYLE,
          top: 770,
          fontSize: 40,
          fontWeight: 500,
          color: COLOR.warm,
          opacity: snap(frame, 46, 12),
        }}
      >
        Chrome extension · Android app · one library on both
      </div>
      <div
        style={{
          ...LINE_STYLE,
          top: 970,
          fontSize: 30,
          color: COLOR.dim,
          opacity: snap(frame, 56, 14),
          whiteSpace: "pre",
        }}
      >
        {FOOT}
      </div>
      <AbsoluteFill
        style={{ background: "#fff", opacity: 0.12 * hit(frame, 0, 9) }}
      />
    </AbsoluteFill>
  );
};
