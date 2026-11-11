// The opening: Foundry's own Setup, then its module cards lift out, sort
// themselves into folders on a board, and settle as Stagehand's Library.
// Both ends are the pages as captured; the move between them is animation.
import type { FC, ReactNode } from "react";
import { Img, useCurrentFrame } from "remotion";
import { capture, type Rect, shot, SHOTS } from "../data";
import { ease, lerp, pop } from "../motion";
import { Shot, Slice } from "../parts/Shot";
import { Stage } from "../parts/Stage";
import { BOARD_SCALE, FLIGHTS, FOLD, type Head, HEADS } from "../sort-layout";
import { COLOR, fontFamily, PAGE } from "../theme";
import {
  CHROME_FROM,
  LIFT_FROM,
  PAGE_GONE,
  REAL_FROM,
  REAL_IN,
  SETTLE_FRAMES,
  SETTLE_FROM,
  SETTLE_STEP,
  SORT_FROM,
  SORT_STEP,
} from "./change-timing";
import { FlyingCard } from "./FlyingCard";

const TILT = 9;
const main = capture.library.chrome.main;
const HEADER: Rect = [0, 0, PAGE.width, main[1]];
const RAIL: Rect = [0, main[1], main[0], PAGE.height - main[1]];
const MAIN_TOP: Rect = [
  main[0],
  main[1],
  PAGE.width - main[0],
  capture.library.chrome.list[1] - main[1],
];

/**
 * A folder on the board: its name pops in ahead of its first card; as the
 * board settles the name gives way to the page's own heading.
 */
const FolderHead: FC<{ readonly head: Head }> = ({ head }) => {
  const frame = useCurrentFrame();
  const shown = pop(frame, SORT_FROM + head.order * SORT_STEP - 6, 12);
  const from = SETTLE_FROM + head.group * SETTLE_STEP;
  const settled = ease(frame, from, from + SETTLE_FRAMES);
  if (shown <= 0) return null;
  const x = lerp(head.board.x, head.real[0], settled);
  const y = lerp(head.board.y, head.real[1], settled);
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: x,
          top: y - 5,
          opacity: Math.min(1, shown * 1.5) * (1 - settled),
          transformOrigin: "0 50%",
          transform: `scale(${0.6 + 0.4 * shown})`,
          fontFamily,
          fontSize: 15,
          fontWeight: 600,
          color: COLOR.fg,
          whiteSpace: "nowrap",
          borderLeft: `4px solid ${head.color}`,
          paddingLeft: 7,
          lineHeight: "18px",
        }}
      >
        {head.name}
      </div>
      {head.real[1] < FOLD && (
        <Img
          src={shot(`sh/folders/${head.id}.png`)}
          style={{
            position: "absolute",
            left: x,
            top: y,
            width: head.real[2],
            height: head.real[3],
            opacity: settled,
            transformOrigin: "0 0",
            transform: `scale(${lerp(BOARD_SCALE, 1, settled)})`,
          }}
        />
      )}
    </>
  );
};

/** The board leans back a little while the cards sort, like a table top. */
const Board: FC<{ readonly children: ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const lean =
    ease(frame, SORT_FROM, SORT_FROM + 34) *
    (1 - ease(frame, SETTLE_FROM, SETTLE_FROM + SETTLE_FRAMES));
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transformOrigin: "50% 42%",
        transform: `perspective(1700px) rotateX(${TILT * lean}deg)`,
      }}
    >
      {children}
    </div>
  );
};

/** "Foundry Virtual Tabletop": the big title shrinks into Stagehand's corner. */
const Title: FC = () => {
  const frame = useCurrentFrame();
  const from = capture.stock.chrome.title;
  const to = capture.library.chrome.title;
  const t = ease(frame, LIFT_FROM, LIFT_FROM + 44);
  const ratio = to[2] / from[2];
  const fade = ease(frame, LIFT_FROM + 22, LIFT_FROM + 44);
  return (
    <div
      style={{
        position: "absolute",
        left: lerp(from[0], to[0], t),
        top: lerp(from[1], to[1], t),
        transformOrigin: "0 0",
        transform: `scale(${lerp(1, ratio, t)})`,
      }}
    >
      <Slice
        src={SHOTS.stock}
        rect={from}
        at={{ x: 0, y: 0 }}
        style={{ opacity: 1 - fade }}
      />
      <Slice
        src={SHOTS.library}
        rect={to}
        at={{ x: 0, y: 0 }}
        style={{
          opacity: fade,
          transformOrigin: "0 0",
          transform: `scale(${1 / ratio})`,
        }}
      />
    </div>
  );
};

/** Stagehand's frame arrives around the settling cards. */
const ChromeIn: FC = () => {
  const frame = useCurrentFrame();
  const t = ease(frame, CHROME_FROM, CHROME_FROM + 28);
  if (t <= 0) return null;
  return (
    <>
      <Slice
        src={SHOTS.library}
        rect={HEADER}
        style={{
          opacity: t,
          transform: `translateY(${(t - 1) * HEADER[3]}px)`,
        }}
      />
      <Slice
        src={SHOTS.library}
        rect={RAIL}
        style={{ opacity: t, transform: `translateX(${(t - 1) * RAIL[2]}px)` }}
      />
      <Slice src={SHOTS.library} rect={MAIN_TOP} style={{ opacity: t }} />
    </>
  );
};

export const SceneChange: FC = () => {
  const frame = useCurrentFrame();
  return (
    <Stage>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 50% 40%, #1b1728 0%, #0c0b14 70%)",
        }}
      />
      <Shot src={SHOTS.stock} opacity={1 - ease(frame, LIFT_FROM, PAGE_GONE)} />
      <ChromeIn />
      <Board>
        {HEADS.map((head) => (
          <FolderHead key={head.id} head={head} />
        ))}
        {FLIGHTS.map((flight) => (
          <FlyingCard key={flight.id} flight={flight} />
        ))}
      </Board>
      {frame < REAL_IN && <Title />}
      <div style={{ position: "absolute", inset: 0, zIndex: 5 }}>
        <Shot src={SHOTS.library} opacity={ease(frame, REAL_FROM, REAL_IN)} />
      </div>
    </Stage>
  );
};
