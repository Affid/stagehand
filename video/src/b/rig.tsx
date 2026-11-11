// Stage rigging, after Stagehand's mark: panels fly in from above on ropes
// and are hauled back up, and a sandbag on its own rope goes the other way,
// as a counterweight does.
import type { CSSProperties, FC, ReactNode } from "react";
import { spring, useCurrentFrame } from "remotion";
import { FPS, lerp } from "../motion";
import { hit, rush, snap } from "./kit";
import { B_SCENES, HAUL } from "./timeline";

const ROPE = "#d9cdb4";
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

/** Two ropes for a wide panel, one for a narrow one. */
export const TWO = ["12%", "88%"] as const;
export const ONE = ["50%"] as const;

const Rope: FC<{ readonly x: string }> = ({ x }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      bottom: "100%",
      width: 5,
      height: ABOVE + 400,
      marginLeft: -2.5,
      background: ROPE,
      boxShadow: "0 0 0 1px rgba(0,0,0,0.35)",
    }}
  />
);

/** Something hung from the flies: in at `inAt`, hauled up at `outAt`. */
export const Hung: FC<{
  readonly inAt: number;
  readonly outAt?: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  /** Where the ropes are tied, across the panel's width. */
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
        <Rope key={x} x={x} />
      ))}
      {children}
    </div>
  );
};

// ---- The sandbag ----

/** Every frame a panel changes: the bag drops as one goes up, and rises
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
const REST = { x: 1838, y: 60 } as const;
const DROP = 560;
/** Video pixels per unit of the mark's drawing: on the rope, and in the mark. */
const BIG = 6.2;
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

const Bag: FC<{
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly sway: number;
  readonly rope?: number;
}> = ({ x, y, scale, sway, rope = 1 }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      transformOrigin: "0 -900px",
      transform: `rotate(${sway}deg)`,
    }}
  >
    <div
      style={{
        position: "absolute",
        left: -2.5,
        bottom: 0,
        width: 5,
        height: 2400,
        background: ROPE,
        opacity: rope,
      }}
    />
    <svg
      width={16 * scale}
      height={24 * scale}
      viewBox="55.6 59 16 24"
      style={{ position: "absolute", left: -8 * scale, top: -1 * scale }}
    >
      <path
        fill="#c0584a"
        d="M63.6,60 C58,64 56,72 57,76.5 Q63.6,82 70.2,76.5 C71.2,72 69.2,64 63.6,60 Z"
      />
      <rect x="60" y="63.2" width="7.2" height="2.2" fill="#8e3329" />
    </svg>
  </div>
);

/** The counterweight at the side of the stage through the working scenes. */
export const Sandbag: FC = () => {
  const frame = useCurrentFrame();
  if (frame < FIRST || frame >= GONE + 10) return null;
  const arrive = snap(frame, FIRST, 14);
  const leave = rush(frame, GONE, 9);
  const y = lerp(-300, REST.y, arrive) + DROP * dip(frame) - leave * 700;
  const sway = 1.6 * Math.sin(frame / 9) + 4 * hit(frame, FIRST + 10, 30);
  return <Bag x={REST.x} y={y} scale={BIG} sway={sway} />;
};

/** The bag comes down into the mark's own drawing and stays there. */
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
  const since = Math.max(0, frame - at);
  return (
    <Bag
      x={markLeft + BAG_IN_MARK.x}
      y={lerp(-200, markTop + BAG_IN_MARK.y, down)}
      scale={MARK_SCALE}
      sway={7 * Math.exp(-since / 20) * Math.sin(since / 4)}
      rope={1 - Math.min(1, down)}
    />
  );
};
