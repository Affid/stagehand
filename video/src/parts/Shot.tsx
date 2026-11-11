// A captured page, whole (Shot) or one rectangle of it (Slice), placed in
// the page's own pixels.
import type { CSSProperties, FC } from "react";
import { Img } from "remotion";
import type { Rect } from "../data";
import { PAGE } from "../theme";

const FULL: CSSProperties = {
  position: "absolute",
  left: 0,
  top: 0,
  width: PAGE.width,
  height: PAGE.height,
  maxWidth: "none",
};

export const Shot: FC<{ readonly src: string; readonly opacity?: number }> = ({
  src,
  opacity = 1,
}) => (opacity <= 0 ? null : <Img src={src} style={{ ...FULL, opacity }} />);

export const Slice: FC<{
  readonly src: string;
  readonly rect: Rect;
  /** Where to draw it, when not where it was captured. */
  readonly at?: { readonly x: number; readonly y: number };
  readonly style?: CSSProperties;
}> = ({ src, rect, at, style }) => (
  <div
    style={{
      position: "absolute",
      left: at?.x ?? rect[0],
      top: at?.y ?? rect[1],
      width: rect[2],
      height: rect[3],
      overflow: "hidden",
      ...style,
    }}
  >
    <Img src={src} style={{ ...FULL, left: -rect[0], top: -rect[1] }} />
  </div>
);
