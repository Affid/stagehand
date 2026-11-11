// By world: a click on the tab, then the camera moves in on the table and
// each world's column lights up in turn.
import type { FC } from "react";
import { useCurrentFrame } from "remotion";
import { capture, centre, SHOTS } from "../data";
import { ease, pulse, track } from "../motion";
import { Cursor, type CursorPath } from "../parts/Cursor";
import { Shot } from "../parts/Shot";
import { type Camera, Stage } from "../parts/Stage";
import { COLOR } from "../theme";
import { BY_WORLD_END } from "./cameras";

const { table, columns } = capture.walk.byWorld;
const tab = centre(capture.library.chrome.byWorldTab);

const CLICK = 21;
const MOVE_IN = [36, 78] as const;
const FIRST_COLUMN = 88;
const COLUMN_GAP = 24;

const POINTER: CursorPath = {
  points: [
    [2, 780, 440],
    [CLICK - 1, tab.x, tab.y],
  ],
  clicks: [CLICK],
};

function cameraAt(frame: number): Camera {
  const [from, to] = MOVE_IN;
  return {
    x: track(frame, [
      [from, 640],
      [to, BY_WORLD_END.x],
    ]),
    y: track(frame, [
      [from, 360],
      [to, 330],
      [178, BY_WORLD_END.y],
    ]),
    scale: track(frame, [
      [from, 1],
      [to, BY_WORLD_END.scale],
    ]),
  };
}

export const ByWorld: FC = () => {
  const frame = useCurrentFrame();
  const camera = cameraAt(frame);
  return (
    <>
      <Stage camera={camera}>
        <Shot src={SHOTS.library} />
        <Shot src={SHOTS.byWorld} opacity={ease(frame, CLICK + 3, CLICK + 9)} />
        {columns.map((column, i) => (
          <div
            key={column[0]}
            style={{
              position: "absolute",
              left: column[0] + 4,
              top: table[1] + 6,
              width: column[2] - 8,
              height: table[3] - 12,
              borderRadius: 8,
              background: COLOR.warm,
              opacity: 0.2 * pulse(frame, FIRST_COLUMN + i * COLUMN_GAP, 18),
            }}
          />
        ))}
      </Stage>
      <Cursor path={POINTER} camera={camera} />
    </>
  );
};
