// Launch: the review opens first. The pointer stops at the button that
// would apply the change; nothing is launched.
import type { FC } from "react";
import { useCurrentFrame } from "remotion";
import { capture, centre, SHOTS } from "../data";
import { ease, track } from "../motion";
import { Cursor, type CursorPath } from "../parts/Cursor";
import { Shot } from "../parts/Shot";
import { type Camera, Stage } from "../parts/Stage";
import { QUEUE_END } from "./cameras";

const launch = centre(capture.walk.queued.launch);
const apply = centre(capture.walk.review.apply);
const dialog = centre(capture.walk.review.dialog);

/** 29.5 s into the video: the music swells as the review opens. */
const PRESS_LAUNCH = 45;

const TO_LAUNCH: CursorPath = {
  points: [
    [8, launch.x - 330, launch.y + 170],
    [PRESS_LAUNCH - 3, launch.x - 10, launch.y + 4],
  ],
  clicks: [PRESS_LAUNCH],
};
const TO_APPLY: CursorPath = {
  points: [
    [78, apply.x + 190, apply.y - 150],
    [128, apply.x + 20, apply.y + 5],
    [170, apply.x + 20, apply.y + 5],
  ],
  clicks: [],
};

function cameraAt(frame: number): Camera {
  return {
    x: track(frame, [
      [0, QUEUE_END.x],
      [26, 900],
      [50, 900],
      [86, dialog.x],
    ]),
    y: track(frame, [
      [0, QUEUE_END.y],
      [26, 240],
      [50, 240],
      [86, dialog.y],
    ]),
    scale: track(frame, [
      [0, QUEUE_END.scale],
      [26, 1.35],
      [50, 1.35],
      [86, 1.6],
      [190, 1.7],
    ]),
  };
}

export const Review: FC = () => {
  const frame = useCurrentFrame();
  const camera = cameraAt(frame);
  return (
    <>
      <Stage camera={camera}>
        <Shot src={SHOTS.queued} />
        <Shot
          src={SHOTS.review}
          opacity={ease(frame, PRESS_LAUNCH + 2, PRESS_LAUNCH + 10)}
        />
      </Stage>
      <Cursor path={TO_LAUNCH} camera={camera} />
      <Cursor path={TO_APPLY} camera={camera} />
    </>
  );
};
