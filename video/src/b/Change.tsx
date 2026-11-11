// Bars 11 to 14: one switch flipped on a world's page, the change that
// waits, and the review before launch, its rows arriving one at a time.
// Each piece is cut from the page as captured before and after the real
// click.
import type { FC } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { capture, type Rect, SHOTS } from "../data";
import { lerp } from "../motion";
import { COLOR } from "../theme";
import {
  Backdrop,
  BigType,
  Burst,
  hit,
  rush,
  snap,
  type View,
  Window,
} from "./kit";
import { Hung } from "./rig";
import { HAUL } from "./timeline";

/** Ropes tied in from the corners, clear of the name in the top corner. */
const INSET = ["30%", "70%"] as const;

const view = (r: Rect): View => ({ x: r[0], y: r[1], w: r[2], h: r[3] });

// ---- Queue ----

const CARD = capture.walk.world.card;
const TOGGLE = capture.walk.world.toggle;
const WAITS = capture.walk.queued.waits;
const CARD_AT = { left: 330, top: 220, width: 1260 } as const;
const CARD_SCALE = CARD_AT.width / CARD[2];
const SWITCH = {
  x: CARD_AT.left + (TOGGLE[0] + TOGGLE[2] / 2 - CARD[0]) * CARD_SCALE,
  y: CARD_AT.top + (TOGGLE[1] + TOGGLE[3] / 2 - CARD[1]) * CARD_SCALE,
} as const;
/** 21.0 s: the score clicks here. */
const FLIP = 30;
/** 22.5 s. */
const WAIT_IN = 75;

export const QueueB: FC = () => {
  const frame = useCurrentFrame();
  const note = snap(frame, WAIT_IN, 11);
  const leave = rush(frame, HAUL, 7);
  return (
    <AbsoluteFill>
      <Backdrop />
      <Hung
        inAt={0}
        left={CARD_AT.left}
        top={CARD_AT.top - note * 40}
        width={CARD_AT.width}
        ropes={INSET}
      >
        <Window
          src={frame < FLIP ? SHOTS.world : SHOTS.queued}
          view={view(CARD)}
          width={CARD_AT.width}
          style={{
            position: "relative",
            transform: `scale(${1 + 0.06 * hit(frame, FLIP, 10) - 0.03 * hit(frame, FLIP - 5, 5)})`,
          }}
        />
      </Hung>
      <Burst x={SWITCH.x} y={SWITCH.y} amount={(frame - FLIP) / 16} />
      <Window
        src={SHOTS.queued}
        view={view(WAITS)}
        width={1100}
        style={{
          left: 410,
          top: 520 + lerp(140, 0, note),
          opacity: note * (1 - leave),
          transform: `scale(${1 + 0.05 * hit(frame, WAIT_IN, 10)})`,
          boxShadow: `0 30px 80px rgba(0,0,0,0.6), 0 0 0 3px ${COLOR.warm}`,
        }}
      />
      <BigType
        line={{
          text: "Flip a switch.",
          at: 0,
          until: WAIT_IN,
          accent: ["switch"],
        }}
        size={170}
        style={{ left: 110, top: 800 }}
      />
      <BigType
        line={{
          text: "It waits for launch.",
          at: WAIT_IN,
          until: HAUL + 4,
          accent: ["waits"],
        }}
        size={170}
        style={{ left: 110, top: 800 }}
      />
    </AbsoluteFill>
  );
};

// ---- Review ----

const {
  dialog: DIALOG,
  turnsOn: TURNS_ON,
  backup: BACKUP,
  verdict,
  apply: APPLY,
} = capture.walk.review;
/** The verdict line ends where the list under it begins. */
const VERDICT: Rect = [
  verdict[0],
  verdict[1],
  verdict[2],
  TURNS_ON[1] - verdict[1] - 12,
];
/** The list under the verdict, both columns. */
const CHANGES: Rect = [verdict[0], TURNS_ON[1], verdict[2], TURNS_ON[3]];
const DIALOG_AT = { left: 210, top: 130, width: 1500 } as const;
const DIALOG_SCALE = DIALOG_AT.width / DIALOG[2];
/** 24.5, 25.5 and 26.5 s: the score marks each; the button swells before the cut. */
const OPEN = 15;
const ROWS = [
  { rect: VERDICT, at: 45 },
  { rect: CHANGES, at: 60 },
  { rect: BACKUP, at: 75 },
] as const;
const SWELL = 98;

const inDialog = (r: Rect, pad: number) => ({
  left: (r[0] - DIALOG[0]) * DIALOG_SCALE - pad,
  top: (r[1] - DIALOG[1]) * DIALOG_SCALE - pad,
  width: r[2] * DIALOG_SCALE + pad * 2,
  height: r[3] * DIALOG_SCALE + pad * 2,
});

/** A row stays covered until its beat, then is ringed as it shows. */
const Row: FC<{ readonly row: (typeof ROWS)[number] }> = ({ row }) => {
  const frame = useCurrentFrame();
  const shown = snap(frame, row.at, 7);
  return (
    <>
      <div
        style={{
          position: "absolute",
          ...inDialog(row.rect, 3),
          background: "#0d0c15",
          opacity: 1 - shown,
        }}
      />
      <div
        style={{
          position: "absolute",
          ...inDialog(row.rect, 6),
          borderRadius: 10,
          border: `4px solid ${COLOR.warm}`,
          boxShadow: "0 0 30px rgba(238,155,58,0.55)",
          opacity: shown * (1 - snap(frame, row.at + 16, 10) * 0.8),
        }}
      />
    </>
  );
};

export const ReviewB: FC = () => {
  const frame = useCurrentFrame();
  const button = inDialog(APPLY, 0);
  return (
    <AbsoluteFill>
      <Backdrop />
      <Hung
        inAt={OPEN}
        left={DIALOG_AT.left}
        top={DIALOG_AT.top}
        width={DIALOG_AT.width}
        ropes={INSET}
      >
        <Window
          src={SHOTS.review}
          view={view(DIALOG)}
          width={DIALOG_AT.width}
          style={{ position: "relative" }}
        >
          {ROWS.map((row) => (
            <Row key={row.at} row={row} />
          ))}
        </Window>
        <Window
          src={SHOTS.review}
          view={view(APPLY)}
          width={button.width}
          style={{
            left: button.left,
            top: button.top,
            borderRadius: 8,
            boxShadow: `0 0 ${50 * hit(frame, SWELL, 14)}px rgba(238,155,58,0.8)`,
            transform: `scale(${1 + 0.16 * hit(frame, SWELL, 14)})`,
          }}
        />
      </Hung>
      <BigType
        line={{
          text: "Review it first.",
          at: 0,
          until: 90,
          accent: ["review"],
        }}
        size={170}
        style={{ left: 110, top: 810 }}
      />
      <BigType
        line={{
          text: "Then launch.",
          at: 90,
          until: HAUL + 4,
          accent: ["launch"],
        }}
        size={170}
        style={{ left: 110, top: 810 }}
      />
    </AbsoluteFill>
  );
};
