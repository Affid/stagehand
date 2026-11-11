// Cut B's building blocks: a dark ground with slow colour, type that slams
// in on the beat, and the real page in a floating window.
import type { CSSProperties, FC, ReactNode } from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { lerp } from "../motion";
import { Mark } from "../scenes/EndCard";
import { COLOR, fontFamily } from "../theme";

/** 120 beats a minute at 30 frames a second. */
export const BEAT = 15;

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 0 to 1 from `at`: fast out of the gate, then it lands. */
export const snap = (frame: number, at: number, frames = 10): number =>
  interpolate(frame, [at, at + frames], [0, 1], {
    ...CLAMP,
    easing: Easing.out(Easing.exp),
  });

/** 0 to 1 from `at`: slow start, then it rushes (for exits and whips). */
export const rush = (frame: number, at: number, frames = 8): number =>
  interpolate(frame, [at, at + frames], [0, 1], {
    ...CLAMP,
    easing: Easing.in(Easing.cubic),
  });

/** 1 at `at`, decaying after it: a hit. */
export const hit = (frame: number, at: number, frames = 12): number =>
  frame < at ? 0 : Math.max(0, 1 - (frame - at) / frames) ** 2;

export const Backdrop: FC = () => {
  const frame = useCurrentFrame();
  const a = 50 + 18 * Math.sin(frame / 70);
  const b = 40 + 14 * Math.cos(frame / 90);
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(60% 55% at ${a}% ${b}%, #2a2146 0%, rgba(42,33,70,0) 70%), radial-gradient(45% 40% at ${100 - a}% ${90 - b / 2}%, rgba(238,155,58,0.16) 0%, rgba(238,155,58,0) 70%), #0b0a12`,
      }}
    />
  );
};

export interface TypeLine {
  readonly text: string;
  /** The frame its first word lands on. */
  readonly at: number;
  readonly until: number;
  readonly accent?: readonly string[];
  /** Already landed on its first frame (the thumbnail). */
  readonly still?: boolean;
}

const bare = (word: string): string =>
  word.toLowerCase().replace(/[^a-z0-9']/g, "");

/** Big words, each landing a few frames after the one before. */
export const BigType: FC<{
  readonly line: TypeLine;
  readonly size?: number;
  readonly style?: CSSProperties;
}> = ({ line, size = 190, style }) => {
  const frame = useCurrentFrame();
  if (frame < line.at || frame >= line.until) return null;
  const out = rush(frame, line.until - 5, 5);
  return (
    <div
      style={{
        position: "absolute",
        fontFamily,
        fontWeight: 600,
        fontSize: size,
        lineHeight: 1.02,
        letterSpacing: "-0.01em",
        color: COLOR.fg,
        opacity: 1 - out,
        transform: `translateY(${-30 * out}px)`,
        textShadow: "0 6px 40px rgba(6,5,12,0.8)",
        ...style,
      }}
    >
      {line.text.split(" ").map((word, i) => {
        const t = line.still ? 1 : snap(frame, line.at + i * 3, 9);
        return (
          <span
            key={`${word}-${i}`}
            style={{
              display: "inline-block",
              marginRight: "0.24em",
              opacity: t,
              filter: t < 1 ? `blur(${lerp(14, 0, t)}px)` : undefined,
              transform: `translateY(${lerp(size * 0.35, 0, t)}px) scale(${lerp(1.35, 1, t)})`,
              transformOrigin: "0 80%",
              color: line.accent?.includes(bare(word)) ? COLOR.warm : undefined,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

export interface View {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Part of a captured page (in its CSS pixels) in a rounded, floating frame. */
export const Window: FC<{
  readonly src: string;
  readonly view: View;
  /** Width on screen, in video pixels. */
  readonly width: number;
  readonly style?: CSSProperties;
  readonly children?: ReactNode;
}> = ({ src, view, width, style, children }) => {
  const scale = width / view.w;
  return (
    <div
      style={{
        position: "absolute",
        width,
        height: view.h * scale,
        overflow: "hidden",
        borderRadius: 22,
        background: COLOR.bg,
        boxShadow:
          "0 50px 120px rgba(0,0,0,0.65), 0 0 0 1.5px rgba(239,233,221,0.14)",
        ...style,
      }}
    >
      <Img
        src={src}
        style={{
          position: "absolute",
          left: -view.x * scale,
          top: -view.y * scale,
          width: 1280 * scale,
          maxWidth: "none",
        }}
      />
      {children}
    </div>
  );
};

/** Who this is, in the corner of every working shot. */
export const Bug: FC<{ readonly opacity: number }> = ({ opacity }) => (
  <div
    style={{
      position: "absolute",
      left: 64,
      top: 52,
      display: "flex",
      alignItems: "center",
      gap: 20,
      opacity,
      fontFamily,
      color: COLOR.fg,
    }}
  >
    <div
      style={{
        transform: "scale(0.3)",
        transformOrigin: "0 0",
        width: 69,
        height: 69,
      }}
    >
      <Mark frame={999} />
    </div>
    <div style={{ fontSize: 38, fontWeight: 600 }}>
      Stagehand
      <span style={{ color: COLOR.dim, fontWeight: 400 }}>
        {" "}
        for Foundry VTT
      </span>
    </div>
  </div>
);

/** A drawn pointer at a screen position. */
export const Pointer: FC<{
  readonly x: number;
  readonly y: number;
  readonly opacity: number;
  readonly press: number;
}> = ({ x, y, opacity, press }) => (
  <svg
    width={78}
    height={78}
    viewBox="0 0 24 24"
    style={{
      position: "absolute",
      left: x - 10,
      top: y - 6,
      opacity,
      transform: `scale(${1 - 0.16 * press})`,
      transformOrigin: "10px 6px",
      filter: "drop-shadow(0 5px 8px rgba(0,0,0,0.6))",
    }}
  >
    <path
      d="M4 2.5 L4 19 L8.6 14.9 L11.6 21.4 L14.4 20.1 L11.5 13.8 L17.6 13.6 Z"
      fill="#ffffff"
      stroke="#16131f"
      strokeWidth={1.3}
      strokeLinejoin="round"
    />
  </svg>
);

/** An amber ring that bursts outward from a hit. */
export const Burst: FC<{
  readonly x: number;
  readonly y: number;
  readonly amount: number;
  readonly size?: number;
}> = ({ x, y, amount, size = 520 }) =>
  amount <= 0 || amount >= 1 ? null : (
    <div
      style={{
        position: "absolute",
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: size,
        border: `${lerp(14, 1, amount)}px solid ${COLOR.warm}`,
        opacity: 1 - amount,
        transform: `scale(${lerp(0.2, 1, amount)})`,
      }}
    />
  );
