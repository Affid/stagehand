// The narrator: a small gold ball that bounces from one thing to the next,
// landing on each as the type names it. It is the pulley wheel from
// Stagehand's mark, and drops back into the mark at the end.
import type { FC } from "react";
import { useCurrentFrame } from "remotion";
import { lerp } from "../motion";
import { type Landing, type Run, RUNS } from "./ball-path";

const SIZE = 64;
const SQUASH_FRAMES = 5;
const TRAIL = [1.2, 2.4, 3.6] as const;

interface Pose {
  readonly x: number;
  readonly y: number;
  /** Frames since the last landing. */
  readonly since: number;
  /** -1 rising, 1 falling: which way it stretches. */
  readonly speed: number;
}

/** The arc between two landings: higher for a longer jump. */
function arc(from: Landing, to: Landing, frame: number): Pose {
  const t = (frame - from.frame) / (to.frame - from.frame);
  const reach = Math.hypot(to.x - from.x, to.y - from.y);
  const height = Math.min(420, 110 + reach * 0.28);
  return {
    x: lerp(from.x, to.x, t),
    y: lerp(from.y, to.y, t) - height * 4 * t * (1 - t),
    since: frame - from.frame,
    speed: Math.abs(2 * t - 1),
  };
}

function poseIn(run: Run, frame: number): Pose | null {
  for (let i = 0; i + 1 < run.length; i++) {
    const from = run[i];
    const to = run[i + 1];
    if (from && to && frame >= from.frame && frame < to.frame)
      return arc(from, to, frame);
  }
  return null;
}

const poseAt = (frame: number): Pose | null =>
  RUNS.map((run) => poseIn(run, frame)).find((pose) => pose !== null) ?? null;

const Dot: FC<{ readonly pose: Pose; readonly ghost: number }> = ({
  pose,
  ghost,
}) => {
  const squash = ghost
    ? 0
    : Math.max(0, 1 - pose.since / SQUASH_FRAMES) * (pose.since >= 0 ? 1 : 0);
  const stretch = ghost ? 0 : pose.speed * 0.14;
  const size = SIZE * (1 - ghost * 0.16);
  return (
    <div
      style={{
        position: "absolute",
        left: pose.x - size / 2,
        top: pose.y - size,
        width: size,
        height: size,
        borderRadius: size,
        opacity: ghost ? 0.28 / ghost : 1,
        transformOrigin: "50% 100%",
        transform: `scale(${1 + squash * 0.32 - stretch * 0.5}, ${1 - squash * 0.36 + stretch})`,
        background:
          "radial-gradient(circle at 36% 30%, #ffe2a0 0%, #eeab45 42%, #b9741f 100%)",
        boxShadow: ghost
          ? undefined
          : "0 0 34px rgba(238,155,58,0.65), inset 0 -6px 10px rgba(120,60,10,0.45)",
      }}
    />
  );
};

/** A ring where it has just landed. */
const Ripple: FC<{ readonly frame: number }> = ({ frame }) => {
  const landing = RUNS.flat().find(
    (l) => frame >= l.frame && frame < l.frame + 10,
  );
  if (!landing) return null;
  const t = (frame - landing.frame) / 10;
  const size = 60 + t * 150;
  return (
    <div
      style={{
        position: "absolute",
        left: landing.x - size / 2,
        top: landing.y - size * 0.18,
        width: size,
        height: size * 0.36,
        borderRadius: "50%",
        border: "4px solid rgba(238,171,69,0.9)",
        opacity: 1 - t,
      }}
    />
  );
};

export const Ball: FC = () => {
  const frame = useCurrentFrame();
  const pose = poseAt(frame);
  return (
    <>
      <Ripple frame={frame} />
      {pose &&
        TRAIL.map((back, i) => {
          const ghost = poseAt(frame - back);
          return ghost ? <Dot key={back} pose={ghost} ghost={i + 1} /> : null;
        })}
      {pose && <Dot pose={pose} ghost={0} />}
    </>
  );
};
