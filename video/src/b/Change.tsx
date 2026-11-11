// Bars 9 to 12: one switch flipped on a world's page, the change that
// waits, and the review before launch. Each piece is cut from the page as
// captured before and after the real click.
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

const view = (r: Rect): View => ({ x: r[0], y: r[1], w: r[2], h: r[3] });
const LEAVE = 113;

// ---- Queue ----

const CARD = capture.walk.world.card;
const TOGGLE = capture.walk.world.toggle;
const WAITS = capture.walk.queued.waits;
const CARD_AT = { x: 330, y: 450, width: 1260 } as const;
const CARD_SCALE = CARD_AT.width / CARD[2];
export const SWITCH = {
  x: CARD_AT.x + (TOGGLE[0] + TOGGLE[2] / 2 - CARD[0]) * CARD_SCALE,
  y: CARD_AT.y + (TOGGLE[1] + TOGGLE[3] / 2 - CARD[1]) * CARD_SCALE,
} as const;
/** 17.0 s: the score clicks here. */
export const FLIP = 30;
/** 18.5 s. */
export const WAIT_IN = 75;

export const QueueB: FC = () => {
  const frame = useCurrentFrame();
  const enter = snap(frame, 0, 14);
  const leave = rush(frame, LEAVE, 7);
  const note = snap(frame, WAIT_IN, 11);
  return (
    <AbsoluteFill>
      <Backdrop />
      <Window
        src={frame < FLIP ? SHOTS.world : SHOTS.queued}
        view={view(CARD)}
        width={CARD_AT.width}
        style={{
          left: CARD_AT.x,
          top: CARD_AT.y - note * 70,
          opacity: enter * (1 - leave),
          transform: `scale(${lerp(0.7, 1, enter) + 0.06 * hit(frame, FLIP, 10) + leave * 0.4})`,
        }}
      />
      <Burst x={SWITCH.x} y={SWITCH.y} amount={(frame - FLIP) / 16} />
      <Window
        src={SHOTS.queued}
        view={view(WAITS)}
        width={1100}
        style={{
          left: 410,
          top: 760 + lerp(140, 0, note),
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
        style={{ left: 110, top: 170 }}
      />
      <BigType
        line={{
          text: "It waits for launch.",
          at: WAIT_IN,
          until: LEAVE + 4,
          accent: ["waits"],
        }}
        size={170}
        style={{ left: 110, top: 170 }}
      />
    </AbsoluteFill>
  );
};

// ---- Review ----

export const DIALOG = capture.walk.review.dialog;
const { turnsOn: TURNS_ON, backup: BACKUP, verdict } = capture.walk.review;
/** The verdict line ends where the list under it begins. */
const VERDICT: Rect = [
  verdict[0],
  verdict[1],
  verdict[2],
  TURNS_ON[1] - verdict[1] - 12,
];
export const DIALOG_WIDTH = 1500;
export const DIALOG_AT = { left: 210, top: 370 } as const;
export const DIALOG_SCALE = DIALOG_WIDTH / DIALOG[2];
/** 20.5, 21.5 and 22.5 s: the score marks each. */
const OPEN = 15;
export const ROWS = [
  { rect: VERDICT, at: 45 },
  { rect: TURNS_ON, at: 60 },
  { rect: BACKUP, at: 75 },
] as const;

export const ReviewB: FC = () => {
  const frame = useCurrentFrame();
  const open = snap(frame, OPEN, 13);
  const leave = rush(frame, LEAVE, 7);
  const swell = lerp(1, 1.05, Math.max(0, (frame - 90) / 30));
  return (
    <AbsoluteFill>
      <Backdrop />
      <Window
        src={SHOTS.review}
        view={view(DIALOG)}
        width={DIALOG_WIDTH}
        style={{
          ...DIALOG_AT,
          opacity: open * (1 - leave),
          transformOrigin: "50% 100%",
          transform: `perspective(1600px) rotateX(${lerp(38, 0, open)}deg) scale(${lerp(0.8, 1, open) * swell + leave * 0.5})`,
        }}
      >
        {ROWS.map((row) => (
          <div
            key={row.at}
            style={{
              position: "absolute",
              left: (row.rect[0] - DIALOG[0]) * DIALOG_SCALE - 6,
              top: (row.rect[1] - DIALOG[1]) * DIALOG_SCALE - 6,
              width: row.rect[2] * DIALOG_SCALE + 12,
              height: row.rect[3] * DIALOG_SCALE + 12,
              borderRadius: 10,
              border: `4px solid ${COLOR.warm}`,
              boxShadow: "0 0 30px rgba(238,155,58,0.55)",
              opacity:
                snap(frame, row.at, 6) *
                (1 - snap(frame, row.at + 16, 10) * 0.75),
            }}
          />
        ))}
      </Window>
      <BigType
        line={{
          text: "Review it first.",
          at: 0,
          until: 90,
          accent: ["review"],
        }}
        size={170}
        style={{ left: 110, top: 150 }}
      />
      <BigType
        line={{
          text: "Then launch.",
          at: 90,
          until: LEAVE + 4,
          accent: ["launch"],
        }}
        size={170}
        style={{ left: 110, top: 150 }}
      />
    </AbsoluteFill>
  );
};
