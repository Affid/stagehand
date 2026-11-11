// One module card on its way from Foundry's list to its folder: it lifts,
// flies in an arc, turns over from Foundry's card to Stagehand's, and lands.
import type { FC } from "react";
import { Img, useCurrentFrame } from "remotion";
import { shot } from "../data";
import { ease, lerp, pop } from "../motion";
import { BOARD_SCALE, colorOf, type Flight, FOLD } from "../sort-layout";
import {
  LIFT_FROM,
  SETTLE_FRAMES,
  SETTLE_FROM,
  SETTLE_STEP,
  SORT_FROM,
  SORT_STEP,
} from "./change-timing";

const ARC = 46;
const SWELL = 0.12;

interface Pose {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  /** 0 on Foundry's list, 1 on the board. */
  readonly flown: number;
  /** 0 on the board, 1 in the Library. */
  readonly settled: number;
}

function poseOf(flight: Flight, frame: number): Pose {
  const q = pop(frame, SORT_FROM + flight.order * SORT_STEP, 15);
  const flown = Math.min(1, Math.max(0, q));
  const from = SETTLE_FROM + flight.group * SETTLE_STEP;
  const settled = ease(frame, from, from + SETTLE_FRAMES);
  const arc = Math.sin(Math.PI * flown);
  return {
    x: lerp(lerp(flight.start.x, flight.board.x, q), flight.real[0], settled),
    y: lerp(
      lerp(flight.start.y, flight.board.y, q) - ARC * arc,
      flight.real[1],
      settled,
    ),
    scale: lerp(lerp(1, BOARD_SCALE, flown) + SWELL * arc, 1, settled),
    flown,
    settled,
  };
}

export const FlyingCard: FC<{ readonly flight: Flight }> = ({ flight }) => {
  const frame = useCurrentFrame();
  const pose = poseOf(flight, frame);
  const belowFold = flight.real[1] + flight.real[3] > FOLD;
  const opacity = belowFold ? 1 - pose.settled : 1;
  if (opacity <= 0) return null;
  const lift = ease(frame, LIFT_FROM, LIFT_FROM + 14) * (1 - pose.settled);
  const turned = pose.flown >= 0.5;
  const tint = pose.flown * (1 - pose.settled);
  const [w, h] = turned
    ? [flight.real[2], flight.real[3]]
    : [flight.stock[2], flight.stock[3]];
  return (
    <div
      style={{
        position: "absolute",
        left: pose.x,
        top: pose.y,
        opacity,
        zIndex: pose.flown > 0 && pose.flown < 1 ? 3 : 2,
        transformOrigin: "0 0",
        transform: `scale(${pose.scale})`,
      }}
    >
      <div
        style={{
          position: "relative",
          width: w,
          height: h,
          borderRadius: 4,
          transform: `perspective(700px) rotateY(${pose.flown * 180}deg)`,
          boxShadow: `0 ${8 * lift}px ${22 * lift}px rgba(0,0,0,${0.55 * lift})`,
        }}
      >
        <Img
          src={shot(`${turned ? "sh" : "stock"}/cards/${flight.id}.png`)}
          style={{
            display: "block",
            width: w,
            height: h,
            transform: turned ? "rotateY(180deg)" : undefined,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 4,
            opacity: tint,
            background: `${colorOf(flight.group)}55`,
            boxShadow: `inset 0 0 0 2px ${colorOf(flight.group)}`,
          }}
        />
      </div>
    </div>
  );
};
