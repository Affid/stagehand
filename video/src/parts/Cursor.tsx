// A drawn pointer that travels between page points and clicks. The clicks
// it shows were made for real when the pages were captured; the pointer
// itself is drawn.
import type { FC } from "react";
import { useCurrentFrame } from "remotion";
import { ease, track } from "../motion";
import { type Camera, toScreen } from "./Stage";

export interface CursorPath {
  /** Frame, page x, page y. */
  readonly points: readonly (readonly [number, number, number])[];
  readonly clicks: readonly number[];
}

const RIPPLE = 16;

export const Cursor: FC<{
  readonly path: CursorPath;
  readonly camera: Camera;
}> = ({ path, camera }) => {
  const frame = useCurrentFrame();
  const first = path.points[0];
  const last = path.points[path.points.length - 1];
  if (!first || !last) return null;
  const x = track(
    frame,
    path.points.map((p) => [p[0], p[1]] as const),
  );
  const y = track(
    frame,
    path.points.map((p) => [p[0], p[2]] as const),
  );
  const at = toScreen(camera, x, y);
  const opacity =
    ease(frame, first[0], first[0] + 6) *
    (1 - ease(frame, last[0] + 14, last[0] + 22));
  if (opacity <= 0) return null;
  const click = path.clicks.find((c) => frame >= c && frame < c + RIPPLE);
  const ring = click === undefined ? 0 : (frame - click) / RIPPLE;
  const press = click === undefined ? 1 : 0.86 + 0.14 * Math.min(1, ring * 2.5);
  return (
    <div style={{ position: "absolute", left: at.x, top: at.y, opacity }}>
      {click !== undefined && (
        <div
          style={{
            position: "absolute",
            left: -60,
            top: -60,
            width: 120,
            height: 120,
            borderRadius: 60,
            border: "5px solid rgba(238,155,58,0.95)",
            opacity: 1 - ring,
            transform: `scale(${0.25 + ring * 0.75})`,
          }}
        />
      )}
      <svg
        width={54}
        height={54}
        viewBox="0 0 24 24"
        style={{
          position: "absolute",
          left: -6,
          top: -4,
          transform: `scale(${press})`,
          transformOrigin: "6px 4px",
          filter: "drop-shadow(0 3px 5px rgba(0,0,0,0.6))",
        }}
      >
        <path
          d="M4 2.5 L4 19 L8.6 14.9 L11.6 21.4 L14.4 20.1 L11.5 13.8 L17.6 13.6 Z"
          fill="#ffffff"
          stroke="#16131f"
          strokeWidth={1.3}
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};
