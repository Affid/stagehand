// Stage rigging reduced to lines: panels come down on two thin lines and
// go back up, and a small weight on its own line moves the other way, as a
// counterweight does. After Stagehand's mark (a rope, a wheel, a bag).
import type { CSSProperties, FC, ReactNode } from "react";
import { spring, useCurrentFrame } from "remotion";
import { FPS, lerp } from "../motion";
import { COLOR } from "../theme";
import { rush, snap } from "./kit";
import { B_SCENES, HAUL } from "./timeline";

const LINE = "rgba(239,233,221,0.5)";
const ABOVE = 1500;

/** How far above its place a panel is, and how it swings as it lands. */
function flight(frame: number, inAt: number, outAt: number) {
  const down = spring({
    frame: frame - inAt,
    fps: FPS,
    config: { damping: 13, stiffness: 120, mass: 0.9 },
  });
  const up = rush(frame, outAt, 8);
  const since = Math.max(0, frame - inAt);
  return {
    y: lerp(-ABOVE, 0, down) - up * ABOVE,
    swing: 2.4 * Math.exp(-since / 12) * Math.sin(since / 2.8),
    here: frame >= inAt && up < 1,
  };
}

/** Two lines for a wide panel, one for a narrow one. */
export const TWO = ["12%", "88%"] as const;
export const ONE = ["50%"] as const;

const Line: FC<{ readonly x: string }> = ({ x }) => (
  <>
    <div
      style={{
        position: "absolute",
        left: x,
        bottom: "100%",
        width: 3,
        marginLeft: -1.5,
        height: ABOVE + 400,
        background: LINE,
      }}
    />
    <div
      style={{
        position: "absolute",
        left: x,
        top: -6,
        width: 12,
        height: 12,
        marginLeft: -6,
        borderRadius: 6,
        background: COLOR.fg,
      }}
    />
  </>
);

/** Something lowered into view: in at `inAt`, taken back up at `outAt`. */
export const Hung: FC<{
  readonly inAt: number;
  readonly outAt?: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  /** Where the lines meet the panel, across its width. */
  readonly ropes?: readonly string[];
  readonly style?: CSSProperties;
  readonly children: ReactNode;
}> = ({
  inAt,
  outAt = HAUL,
  left,
  top,
  width,
  ropes = TWO,
  style,
  children,
}) => {
  const frame = useCurrentFrame();
  const { y, swing, here } = flight(frame, inAt, outAt);
  if (!here) return null;
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width,
        transformOrigin: "50% -600px",
        transform: `translateY(${y}px) rotate(${swing}deg)`,
        ...style,
      }}
    >
      {ropes.map((x) => (
        <Line key={x} x={x} />
      ))}
      {children}
    </div>
  );
};

// ---- The counterweight ----

/** Every frame a panel changes: the weight drops as one goes up, and rises
 * as the next comes down. */
const CHANGES = [
  B_SCENES.library.from,
  B_SCENES.devices.from,
  B_SCENES.devices.from + 30,
  B_SCENES.world.from,
  B_SCENES.world.from + 30,
  B_SCENES.queue.from,
  B_SCENES.review.from,
] as const;
const FIRST = B_SCENES.library.from - 10;
const GONE = B_SCENES.recap.from;
const REST = { x: 1846, y: 120 } as const;
const DROP = 560;
const WEIGHT = { width: 26, height: 44 } as const;
export const MARK_SCALE = 230 / 64;

/** The bag's top, measured from the mark's corner, in video pixels. */
export const BAG_IN_MARK = {
  x: (63.6 - 22) * MARK_SCALE,
  y: (60 - 21) * MARK_SCALE,
} as const;

const dip = (frame: number): number =>
  Math.max(
    ...CHANGES.map((c) =>
      frame < c ? rush(frame, c - 9, 9) : 1 - snap(frame, c, 16),
    ),
  );

/** A plain weight on a line: a rounded bar in the product's amber. */
const Weight: FC<{ readonly x: number; readonly y: number }> = ({ x, y }) => (
  <>
    <div
      style={{
        position: "absolute",
        left: x - 1.5,
        top: 0,
        width: 3,
        height: Math.max(0, y),
        background: LINE,
      }}
    />
    <div
      style={{
        position: "absolute",
        left: x - WEIGHT.width / 2,
        top: y,
        width: WEIGHT.width,
        height: WEIGHT.height,
        borderRadius: WEIGHT.width / 2,
        background: COLOR.warm,
        boxShadow: "0 0 24px rgba(238,155,58,0.45)",
      }}
    />
  </>
);

/** The counterweight at the side of the stage through the working scenes. */
export const Sandbag: FC = () => {
  const frame = useCurrentFrame();
  if (frame < FIRST || frame >= GONE + 10) return null;
  const arrive = snap(frame, FIRST, 14);
  const leave = rush(frame, GONE, 9);
  const y = lerp(-200, REST.y, arrive) + DROP * dip(frame) - leave * 800;
  return <Weight x={REST.x} y={y} />;
};

/** The bag of the mark, lowered into its place in the drawing. */
export const BagIntoMark: FC<{
  readonly at: number;
  readonly markLeft: number;
  readonly markTop: number;
}> = ({ at, markLeft, markTop }) => {
  const frame = useCurrentFrame();
  const down = spring({
    frame: frame - at,
    fps: FPS,
    config: { damping: 11, stiffness: 110, mass: 0.9 },
  });
  const size = 22 * MARK_SCALE;
  return (
    <svg
      width={size}
      height={size}
      viewBox="52.6 60 22 22"
      style={{
        position: "absolute",
        left: markLeft + BAG_IN_MARK.x - size / 2,
        top: lerp(-300, markTop + BAG_IN_MARK.y, down),
        overflow: "visible",
      }}
    >
      <path
        fill="#c0584a"
        d="M63.6,60 C58,64 56,72 57,76.5 Q63.6,82 70.2,76.5 C71.2,72 69.2,64 63.6,60 Z"
      />
      <rect x="60" y="63.2" width="7.2" height="2.2" fill="#8e3329" />
    </svg>
  );
};
