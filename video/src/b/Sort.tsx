// Bars 3 and 4: the cards burst out, then drop into their folders one pile
// per beat. The cards are the pages' own; the scatter and the board are the
// video's arrangement.
import type { FC } from "react";
import { AbsoluteFill, Img, random, useCurrentFrame } from "remotion";
import { shot } from "../data";
import { lerp } from "../motion";
import {
  BOARD_SCALE,
  colorOf,
  FLIGHTS,
  type Flight,
  HEADS,
} from "../sort-layout";
import { COLOR, fontFamily, K, PAGE } from "../theme";
import { Backdrop, hit, rush, snap } from "./kit";

/** The frame each folder's pile lands on: the score plays a note on each. */
const LAND = [15, 30, 45, 60, 75, 90, 97, 105, 105] as const;
const landOf = (group: number): number => LAND[group] ?? 105;
const DIVE_AT = 110;

interface Scatter {
  readonly x: number;
  readonly y: number;
  readonly turn: number;
}

const scatterOf = (id: string): Scatter => ({
  x: 30 + random(`${id}x`) * (PAGE.width - 320),
  y: 30 + random(`${id}y`) * (PAGE.height - 130),
  turn: (random(`${id}r`) - 0.5) * 56,
});

const Card: FC<{ readonly flight: Flight }> = ({ flight }) => {
  const frame = useCurrentFrame();
  const from = scatterOf(flight.id);
  const out = snap(frame, random(`${flight.id}d`) * 5, 16);
  const row = Math.round((flight.real[1] % 1000) / 94);
  const landed = snap(frame, landOf(flight.group) + (row % 6) * 0.7, 10);
  const drift = Math.sin(frame / 14 + from.turn) * 5 * (1 - landed);
  const sx = lerp(PAGE.width / 2 - 140, from.x, out);
  const sy = lerp(PAGE.height / 2 - 30, from.y, out) + drift;
  const turned = landed >= 0.5;
  const [w, h] = turned
    ? [flight.real[2], flight.real[3]]
    : [flight.stock[2], flight.stock[3]];
  const color = colorOf(flight.group);
  return (
    <div
      style={{
        position: "absolute",
        left: lerp(sx, flight.board.x, landed),
        top: lerp(sy, flight.board.y, landed),
        zIndex: landed > 0 && landed < 1 ? 3 : 1,
        opacity: Math.min(1, out * 2),
        transformOrigin: "0 0",
        transform: `scale(${lerp(lerp(0.1, 0.6, out), BOARD_SCALE, landed)}) rotate(${from.turn * (1 - landed)}deg)`,
      }}
    >
      <div
        style={{
          position: "relative",
          width: w,
          height: h,
          borderRadius: 4,
          transform: `perspective(700px) rotateY(${landed * 180}deg)`,
          boxShadow: "0 10px 26px rgba(0,0,0,0.55)",
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
            opacity: landed,
            background: `${color}55`,
            boxShadow: `inset 0 0 0 2px ${color}`,
          }}
        />
      </div>
    </div>
  );
};

const Labels: FC = () => {
  const frame = useCurrentFrame();
  return (
    <>
      {HEADS.map((head) => {
        const t = snap(frame, landOf(head.group) - 2, 9);
        return (
          <div
            key={head.id}
            style={{
              position: "absolute",
              left: head.board.x,
              top: head.board.y - 7,
              opacity: t,
              transformOrigin: "0 60%",
              transform: `scale(${lerp(1.8, 1, t) + 0.25 * hit(frame, landOf(head.group), 9)})`,
              fontFamily,
              fontSize: 17,
              fontWeight: 600,
              lineHeight: "20px",
              color: COLOR.fg,
              whiteSpace: "nowrap",
              borderLeft: `5px solid ${head.color}`,
              paddingLeft: 8,
            }}
          >
            {head.name}
          </div>
        );
      })}
    </>
  );
};

export const Sort: FC = () => {
  const frame = useCurrentFrame();
  const dive = rush(frame, DIVE_AT, 10);
  const first = HEADS[0]?.board ?? { x: 0, y: 0 };
  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill
        style={{
          opacity: 1 - rush(frame, DIVE_AT + 5, 5),
          transformOrigin: `${(first.x + 120) * K}px ${(first.y + 80) * K}px`,
          transform: `scale(${1 + dive * 2.6})`,
        }}
      >
        <div
          style={{
            width: PAGE.width,
            height: PAGE.height,
            transformOrigin: "0 0",
            transform: `scale(${K})`,
          }}
        >
          <Labels />
          {FLIGHTS.map((flight) => (
            <Card key={flight.id} flight={flight} />
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
