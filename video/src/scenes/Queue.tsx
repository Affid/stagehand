// A world's page: one switch is turned on, and the change is queued for the
// next launch instead of happening at once.
import type { FC } from "react";
import { useCurrentFrame } from "remotion";
import { capture, centre, type Rect, SHOTS } from "../data";
import { ease, pop, pulse, track } from "../motion";
import { Cursor, type CursorPath } from "../parts/Cursor";
import { Shot } from "../parts/Shot";
import { type Camera, HOME, Stage } from "../parts/Stage";
import { COLOR } from "../theme";
import { BY_WORLD_END, QUEUE_END } from "./cameras";

const rail = centre(capture.walk.world.railItem);
const card = centre(capture.walk.world.card);
const toggle = centre(capture.walk.world.toggle);
const WAITS: Rect = capture.walk.queued.waits;

const OPEN_WORLD = 19;
/** 24.5 s into the video: the music marks this click. */
const SWITCH_ON = 75;
const CARD_ZOOM = 2.2;

const TO_WORLD: CursorPath = {
  points: [
    [2, 430, 310],
    [OPEN_WORLD - 1, rail.x - 30, rail.y + 4],
  ],
  clicks: [OPEN_WORLD],
};
const TO_SWITCH: CursorPath = {
  points: [
    [42, toggle.x + 150, toggle.y + 120],
    [SWITCH_ON - 3, toggle.x + 2, toggle.y + 2],
  ],
  clicks: [SWITCH_ON],
};

/** Back out from the By world table, in on the card, then up to the note. */
function axis(
  frame: number,
  start: number,
  home: number,
  onCard: number,
  end: number,
): number {
  return track(frame, [
    [0, start],
    [14, home],
    [30, home],
    [66, onCard],
    [98, onCard],
    [130, end],
  ]);
}

function cameraAt(frame: number): Camera {
  return {
    x: axis(frame, BY_WORLD_END.x, HOME.x, card.x, QUEUE_END.x),
    y: axis(frame, BY_WORLD_END.y, HOME.y, card.y - 10, QUEUE_END.y),
    scale: axis(frame, BY_WORLD_END.scale, 1, CARD_ZOOM, QUEUE_END.scale),
  };
}

export const Queue: FC = () => {
  const frame = useCurrentFrame();
  const camera = cameraAt(frame);
  const noted = pop(frame, 128, 12);
  const pad = 5 + 6 * pulse(frame, 140, 12);
  return (
    <>
      <Stage camera={camera}>
        <Shot src={SHOTS.byWorld} />
        <Shot
          src={SHOTS.world}
          opacity={ease(frame, OPEN_WORLD + 3, OPEN_WORLD + 9)}
        />
        <Shot
          src={SHOTS.queued}
          opacity={ease(frame, SWITCH_ON + 1, SWITCH_ON + 5)}
        />
        <div
          style={{
            position: "absolute",
            left: WAITS[0] - pad,
            top: WAITS[1] - pad,
            width: WAITS[2] + pad * 2,
            height: WAITS[3] + pad * 2,
            borderRadius: 8,
            border: `2px solid ${COLOR.warm}`,
            boxShadow: "0 0 18px rgba(238,155,58,0.5)",
            opacity: Math.min(1, noted) * (1 - ease(frame, 168, 178)),
          }}
        />
      </Stage>
      <Cursor path={TO_WORLD} camera={camera} />
      <Cursor path={TO_SWITCH} camera={camera} />
    </>
  );
};
