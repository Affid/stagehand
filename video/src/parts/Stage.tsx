// The captured page as a stage: everything inside is placed in the page's
// own pixels, and a camera moves in on part of it.
import type { FC, ReactNode } from "react";
import { AbsoluteFill } from "remotion";
import { COLOR, K, PAGE } from "../theme";

export interface Camera {
  /** The page point held at the centre of the frame. */
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

export const HOME: Camera = { x: PAGE.width / 2, y: PAGE.height / 2, scale: 1 };

const within = (value: number, half: number, size: number): number =>
  Math.min(size - half, Math.max(half, value));

/** The camera as a translate and scale, never showing past the page's edge. */
export function cameraOffset(c: Camera): { tx: number; ty: number } {
  const x = within(c.x, PAGE.width / 2 / c.scale, PAGE.width);
  const y = within(c.y, PAGE.height / 2 / c.scale, PAGE.height);
  return {
    tx: PAGE.width / 2 - x * c.scale,
    ty: PAGE.height / 2 - y * c.scale,
  };
}

/** A page point in video pixels, as the camera shows it. */
export function toScreen(
  c: Camera,
  x: number,
  y: number,
): { x: number; y: number } {
  const { tx, ty } = cameraOffset(c);
  return { x: (tx + x * c.scale) * K, y: (ty + y * c.scale) * K };
}

export const Stage: FC<{
  readonly camera?: Camera;
  readonly children: ReactNode;
}> = ({ camera = HOME, children }) => {
  const { tx, ty } = cameraOffset(camera);
  return (
    <AbsoluteFill style={{ background: COLOR.bg, overflow: "hidden" }}>
      <div
        style={{
          width: PAGE.width,
          height: PAGE.height,
          transformOrigin: "0 0",
          transform: `scale(${K})`,
        }}
      >
        <div
          style={{
            position: "absolute",
            width: PAGE.width,
            height: PAGE.height,
            transformOrigin: "0 0",
            transform: `translate(${tx}px, ${ty}px) scale(${camera.scale})`,
          }}
        >
          {children}
        </div>
      </div>
    </AbsoluteFill>
  );
};
