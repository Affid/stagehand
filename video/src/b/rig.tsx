// Stage rigging, after Stagehand's mark: panels fly in from above on ropes
// and are hauled back up, and a sandbag on its own rope goes the other way,
// as a counterweight does.
import type { CSSProperties, FC, ReactNode } from "react";
import { spring, useCurrentFrame } from "remotion";
import { FPS, lerp } from "../motion";
import { hit, rush, snap } from "./kit";
import { B_SCENES, HAUL } from "./timeline";

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

/** Twisted hemp: light and dark strands on the diagonal. */
const HEMP =
  "repeating-linear-gradient(135deg, #e3d5b0 0 5px, #b49f6c 5px 10px)";

const ropeStyle = (width: number): CSSProperties => ({
  width,
  marginLeft: -width / 2,
  borderRadius: width / 2,
  background: HEMP,
  boxShadow: "0 0 0 1px rgba(20,14,6,0.55), 3px 0 6px rgba(0,0,0,0.35)",
});

const Rope: FC<{ readonly x: string }> = ({ x }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      bottom: "100%",
      height: ABOVE + 400,
      marginBottom: BATTEN.gap,
      ...ropeStyle(9),
    }}
  />
);

/** The pipe a flown piece hangs from, a little wider than the piece. */
const BATTEN = { height: 16, gap: 18, over: 34 } as const;

const Batten: FC = () => (
  <>
    <div
      style={{
        position: "absolute",
        left: -BATTEN.over,
        right: -BATTEN.over,
        bottom: "100%",
        height: BATTEN.height,
        marginBottom: BATTEN.gap,
        borderRadius: BATTEN.height / 2,
        background:
          "linear-gradient(180deg, #8d87a3 0%, #4a4560 38%, #211d30 100%)",
        boxShadow: "0 6px 14px rgba(0,0,0,0.5)",
      }}
    />
    {["6%", "94%"].map((x) => (
      <div
        key={x}
        style={{
          position: "absolute",
          left: x,
          bottom: "100%",
          width: 5,
          marginLeft: -2.5,
          height: BATTEN.gap + 4,
          background: "#6d6784",
        }}
      />
    ))}
  </>
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
    <>
      {ropes.map((x) => (
        <Pulley
          key={x}
          x={left + (width * Number.parseFloat(x)) / 100}
          turn={y * 1.4}
          size={58}
        />
      ))}
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
        <Batten />
        {children}
      </div>
    </>
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
const REST = { x: 1838, y: 150 } as const;
const DROP = 520;
const PULLEY_Y = 46;
/** The sack's drawing is 60 by 90; this is its size on the rope. */
const SACK = { width: 60, height: 90, scale: 1.9 } as const;
export const MARK_SCALE = 230 / 64;
/** The mark's own bag is 22 of its units tall. */
const SACK_IN_MARK = (22 * MARK_SCALE) / SACK.height;

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

/** A stage sandbag: a canvas sack, its neck tied off, a stripe round it. */
const Sack: FC = () => (
  <svg
    width="100%"
    height="100%"
    viewBox="0 0 60 90"
    style={{ position: "absolute", inset: 0, overflow: "visible" }}
  >
    <path
      d="M21,14 L16,3 L30,9 L44,3 L39,14 Z"
      fill="#bfa978"
      stroke="#6e5c36"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    <path
      d="M22,19 C20,26 8,35 7,57 C6,77 16,87 30,87 C44,87 54,77 53,57 C52,35 40,26 38,19 Z"
      fill="#cdb98f"
      stroke="#6e5c36"
      strokeWidth="1.6"
    />
    <path
      d="M38,19 C40,26 52,35 53,57 C54,77 44,87 30,87 C40,80 44,66 43,52 C42,38 37,28 34,19 Z"
      fill="#a8935f"
      opacity="0.55"
    />
    <path d="M7.4,50 Q30,59 52.6,50 L53,60 Q30,69 7,60 Z" fill="#c0584a" />
    <path
      d="M30,22 C28,40 28,66 30,86"
      fill="none"
      stroke="#6e5c36"
      strokeWidth="1"
      strokeDasharray="3 3"
      opacity="0.7"
    />
    <rect
      x="19"
      y="12"
      width="22"
      height="8"
      rx="3"
      fill="#e3d5b0"
      stroke="#6e5c36"
      strokeWidth="1.2"
    />
    <path
      d="M23,12 L26,20 M29,12 L32,20 M35,12 L38,20"
      stroke="#8c7a4a"
      strokeWidth="1.2"
    />
  </svg>
);

/** The bag as the mark draws it. */
const MarkBag: FC = () => (
  <svg
    width="100%"
    height="100%"
    viewBox="52.6 60 22 22"
    preserveAspectRatio="xMidYMin meet"
    style={{ position: "absolute", inset: 0, overflow: "visible" }}
  >
    <path
      fill="#c0584a"
      d="M63.6,60 C58,64 56,72 57,76.5 Q63.6,82 70.2,76.5 C71.2,72 69.2,64 63.6,60 Z"
    />
    <rect x="60" y="63.2" width="7.2" height="2.2" fill="#8e3329" />
  </svg>
);

const Bag: FC<{
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly sway: number;
  /** 0: the canvas sack on its rope. 1: the bag in the mark. */
  readonly asMark?: number;
}> = ({ x, y, scale, sway, asMark = 0 }) => {
  const width = SACK.width * scale;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transformOrigin: `0 ${PULLEY_Y - y}px`,
        transform: `rotate(${sway}deg)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: -4 * scale,
          height: 2400,
          opacity: 1 - asMark,
          ...ropeStyle(8),
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -width / 2,
          top: 0,
          width,
          height: SACK.height * scale,
        }}
      >
        <div style={{ position: "absolute", inset: 0, opacity: 1 - asMark }}>
          <Sack />
        </div>
        <div style={{ position: "absolute", inset: 0, opacity: asMark }}>
          <MarkBag />
        </div>
      </div>
    </div>
  );
};

/** A block on the grid: the wheel from Stagehand's mark, turning. */
const Pulley: FC<{
  readonly x: number;
  readonly turn: number;
  readonly size?: number;
}> = ({ x, turn, size = 84 }) => (
  <svg
    width={size}
    height={size}
    viewBox="-12 -12 24 24"
    style={{
      position: "absolute",
      left: x - size / 2,
      top: PULLEY_Y - size / 2,
      zIndex: 2,
    }}
  >
    <rect x="-2" y="-14" width="4" height="8" fill="#8f86a0" />
    <circle r="9.6" fill="#d9a441" />
    <circle r="6.6" fill="#9c7024" />
    <g transform={`rotate(${turn})`}>
      <path d="M-6.6,0 H6.6 M0,-6.6 V6.6" stroke="#d9a441" strokeWidth="1.4" />
    </g>
    <circle r="2.6" fill="#efe3c8" />
  </svg>
);

/** The grid over the stage: a steel beam, and the rope that runs along it
 * from the flown pieces to the counterweight. */
const Grid: FC<{ readonly run: number; readonly opacity: number }> = ({
  run,
  opacity,
}) => (
  <div style={{ opacity }}>
    <div
      style={{
        position: "absolute",
        left: 0,
        top: PULLEY_Y - 34,
        width: REST.x,
        height: 8,
        borderRadius: 4,
        background:
          "repeating-linear-gradient(45deg, #e3d5b0 0 5px, #b49f6c 5px 10px)",
        backgroundPositionX: run,
        boxShadow: "0 0 0 1px rgba(20,14,6,0.55)",
      }}
    />
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        height: 14,
        background:
          "linear-gradient(180deg, #6f6a86 0%, #37324a 55%, #1a1726 100%)",
        boxShadow: "0 6px 16px rgba(0,0,0,0.6)",
      }}
    />
  </div>
);

// ---- The lever bank ----

const BANK = { left: 1500, top: 1012, width: 384, height: 24 } as const;
const LEVER = { length: 82, lean: 27 } as const;

/** One lever per change of scene, thrown as the change happens. */
export const Levers: FC = () => {
  const frame = useCurrentFrame();
  if (frame < FIRST || frame >= GONE + 10) return null;
  const shown = snap(frame, FIRST, 14) * (1 - rush(frame, GONE, 9));
  const gap = BANK.width / (CHANGES.length + 1);
  return (
    <div
      style={{
        opacity: shown,
        transform: `translateY(${(1 - shown) * 120}px)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          ...BANK,
          borderRadius: 8,
          background: "linear-gradient(180deg, #6a5236 0%, #3b2c1d 100%)",
          boxShadow:
            "0 8px 20px rgba(0,0,0,0.6), inset 0 2px 0 rgba(255,220,160,0.18)",
        }}
      />
      {CHANGES.map((change, i) => {
        const thrown = spring({
          frame: frame - (change - 6),
          fps: FPS,
          config: { damping: 9, stiffness: 190, mass: 0.6 },
        });
        const lit = hit(frame, change - 2, 16);
        return (
          <div
            key={change}
            style={{
              position: "absolute",
              left: BANK.left + gap * (i + 1) - 6,
              top: BANK.top - LEVER.length + 8,
              width: 12,
              height: LEVER.length,
              borderRadius: 6,
              background: "linear-gradient(90deg, #9b96ae 0%, #57526b 100%)",
              transformOrigin: "50% 100%",
              transform: `rotate(${lerp(-LEVER.lean, LEVER.lean, thrown)}deg)`,
              boxShadow: "2px 2px 6px rgba(0,0,0,0.5)",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: -8,
                top: -14,
                width: 28,
                height: 28,
                borderRadius: 14,
                background:
                  "radial-gradient(circle at 35% 30%, #e88474 0%, #c0584a 55%, #7d2f25 100%)",
                boxShadow: `0 0 ${30 * lit}px rgba(238,155,58,${lit})`,
              }}
            />
          </div>
        );
      })}
    </div>
  );
};

export const Sandbag: FC = () => {
  const frame = useCurrentFrame();
  if (frame < FIRST || frame >= GONE + 10) return null;
  const arrive = snap(frame, FIRST, 14);
  const leave = rush(frame, GONE, 9);
  const y = lerp(-400, REST.y, arrive) + DROP * dip(frame) - leave * 800;
  const sway = 1.4 * Math.sin(frame / 9) + 3 * hit(frame, FIRST + 10, 30);
  return (
    <>
      <Grid run={y} opacity={arrive * (1 - leave)} />
      <Bag x={REST.x} y={y} scale={SACK.scale} sway={sway} />
      <div style={{ opacity: arrive * (1 - leave) }}>
        <Pulley x={REST.x} turn={y * 1.2} />
      </div>
    </>
  );
};

/** The sack comes down into the mark and becomes the bag drawn there. */
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
  const settled = snap(frame, at + 8, 12);
  return (
    <Bag
      x={markLeft + BAG_IN_MARK.x}
      y={lerp(-300, markTop + BAG_IN_MARK.y, down)}
      scale={lerp(SACK.scale, SACK_IN_MARK, settled)}
      sway={6 * Math.exp(-since / 20) * Math.sin(since / 4)}
      asMark={settled}
    />
  );
};
