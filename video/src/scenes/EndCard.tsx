// The end card: Stagehand's mark (the Fly rope, design/app-icon), its name
// and one line.
import type { FC } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ease, pop } from "../motion";
import { COLOR, fontFamily } from "../theme";

const NAME = "Stagehand";
const LINE = "Module management doesn't have to be tedious.";
const FOOT =
  "github.com/Affid/stagehand  ·  Not affiliated with Foundry Gaming LLC";

/** 34.5 s into the video: the music lands as the mark does. */
const MARK_IN = 6;
const NAME_IN = 20;
const LINE_IN = 46;
const FOOT_IN = 84;

/** The bag hangs from the rope's right end and swings to rest. */
const Mark: FC<{ readonly frame: number }> = ({ frame }) => {
  const settle = Math.exp(-Math.max(0, frame - MARK_IN) / 22);
  const swing = 9 * settle * Math.sin((frame - MARK_IN) / 4.2);
  return (
    <svg width={230} height={230} viewBox="22 21 64 64">
      <rect x="22" y="21" width="64" height="64" rx="12" fill="#2a2340" />
      <rect x="35" y="27.5" width="38" height="3.6" fill="#5a4d78" />
      <rect x="52.4" y="30.6" width="3.2" height="4.4" fill="#8f86a0" />
      <circle cx="54" cy="43" r="9.6" fill="#d9a441" />
      <circle cx="54" cy="43" r="6.6" fill="#9c7024" />
      <circle cx="54" cy="43" r="2.6" fill="#efe3c8" />
      <path
        d="M44.4,76 V43 A9.6,9.6 0 0 1 63.6,43 V61"
        fill="none"
        stroke="#efe3c8"
        strokeWidth="3.2"
      />
      <circle
        cx="44.4"
        cy="79"
        r="2.8"
        fill="none"
        stroke="#efe3c8"
        strokeWidth="2.2"
      />
      <g transform={`rotate(${swing} 63.6 60)`}>
        <path
          fill="#c0584a"
          d="M63.6,60 C58,64 56,72 57,76.5 Q63.6,82 70.2,76.5 C71.2,72 69.2,64 63.6,60 Z"
        />
        <rect x="60" y="63.2" width="7.2" height="2.2" fill="#8e3329" />
      </g>
    </svg>
  );
};

const Rising: FC<{
  readonly parts: readonly string[];
  readonly from: number;
  readonly gap: number;
  readonly frame: number;
  readonly space: string;
}> = ({ parts, from, gap, frame, space }) => (
  <>
    {parts.map((part, i) => {
      const t = pop(frame, from + i * gap, 14);
      return (
        <span
          key={`${part}-${i}`}
          style={{
            display: "inline-block",
            marginRight: space,
            opacity: Math.min(1, t * 1.5),
            transform: `translateY(${(1 - t) * 0.5}em)`,
          }}
        >
          {part}
        </span>
      );
    })}
  </>
);

export const EndCard: FC = () => {
  const frame = useCurrentFrame();
  const mark = pop(frame, MARK_IN, 11);
  return (
    <AbsoluteFill
      style={{
        opacity: ease(frame, 0, 12),
        background:
          "radial-gradient(ellipse at 50% 42%, #1d1830 0%, #0c0b14 72%)",
        fontFamily,
        color: COLOR.fg,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
      }}
    >
      <div
        style={{ transform: `scale(${mark})`, opacity: Math.min(1, mark * 2) }}
      >
        <Mark frame={frame} />
      </div>
      <div
        style={{
          fontSize: 172,
          fontWeight: 600,
          lineHeight: 1.1,
          marginTop: 34,
        }}
      >
        <Rising
          parts={[...NAME]}
          from={NAME_IN}
          gap={1.6}
          frame={frame}
          space="0"
        />
      </div>
      <div style={{ fontSize: 58, fontWeight: 500, marginTop: 18 }}>
        <Rising
          parts={LINE.split(" ")}
          from={LINE_IN}
          gap={2.4}
          frame={frame}
          space="0.27em"
        />
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 70,
          fontSize: 30,
          color: COLOR.dim,
          opacity: ease(frame, FOOT_IN, FOOT_IN + 16),
          whiteSpace: "pre",
        }}
      >
        {FOOT}
      </div>
    </AbsoluteFill>
  );
};
