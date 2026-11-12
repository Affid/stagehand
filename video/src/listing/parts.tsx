// Small pieces of the listing GIF, drawn flat so a GIF keeps them cheap:
// one colour each, no shadows, no gradients, nothing moving by itself.
import type { FC } from "react";
import { fontFamily, COLOR } from "../theme";
import { lerp } from "../motion";
import { snap } from "../b/kit";

export type Point = { readonly x: number; readonly y: number };
export type Box = readonly [x: number, y: number, w: number, h: number];

/** The pointer: an arrow, pressed a little on a click. */
export const Cursor: FC<{ at: Point; press: number }> = ({ at, press }) => (
  <svg
    width={28}
    height={28}
    viewBox="0 0 28 28"
    style={{
      position: "absolute",
      left: at.x - 3,
      top: at.y - 2,
      transform: `scale(${lerp(1, 0.82, press)})`,
      transformOrigin: "3px 2px",
    }}
  >
    <path
      d="M3 2 L3 22 L8.5 17 L12 25 L15.5 23.5 L12 16 L19.5 16 Z"
      fill="#ffffff"
      stroke="#0c0b14"
      strokeWidth={1.6}
      strokeLinejoin="round"
    />
  </svg>
);

/** A ring that grows out of a click, then is gone. */
export const ClickRing: FC<{ at: Point; frame: number; on: number }> = ({
  at,
  frame,
  on,
}) => {
  const t = frame - on;
  if (t < 0 || t > 9) return null;
  const r = lerp(6, 22, t / 9);
  return (
    <div
      style={{
        position: "absolute",
        left: at.x - r,
        top: at.y - r,
        width: r * 2,
        height: r * 2,
        borderRadius: "50%",
        border: `2px solid ${COLOR.warm}`,
      }}
    />
  );
};

/** An amber outline that snaps around what the caption talks about. */
export const Mark: FC<{ box: Box; frame: number; on: number }> = ({
  box,
  frame,
  on,
}) => {
  if (frame < on) return null;
  const t = snap(frame, on, 6);
  const pad = lerp(14, 5, t);
  const [x, y, w, h] = box;
  return (
    <div
      style={{
        position: "absolute",
        left: x - pad,
        top: y - pad,
        width: w + pad * 2,
        height: h + pad * 2,
        borderRadius: 8,
        border: `3px solid ${COLOR.warm}`,
      }}
    />
  );
};

/** The bar under the picture: the scene's line, and the name. */
export const Caption: FC<{ lead: string; rest: string; height: number }> = ({
  lead,
  rest,
  height,
}) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height,
      background: COLOR.bg,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 22px",
      fontFamily,
    }}
  >
    <span style={{ fontSize: 25, fontWeight: 600, color: COLOR.fg }}>
      <span style={{ color: COLOR.warm }}>{lead}</span> {rest}
    </span>
    <span style={{ fontSize: 17, color: COLOR.dim }}>
      <span style={{ color: COLOR.fg, fontWeight: 600 }}>Stagehand</span> for
      Foundry VTT
    </span>
  </div>
);
