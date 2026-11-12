// The listing GIF's two scenes that aren't a captured page: the Android
// app's screens on three phones, and the closing card. Flat, like the rest.
import type { FC } from "react";
import { AbsoluteFill, Img } from "remotion";
import { Mark } from "../scenes/EndCard";
import { COLOR, fontFamily } from "../theme";
import { PHONES } from "./shots";

const PHONE = { width: 214, height: 476, border: 7 } as const;

export const Phones: FC<{ height: number }> = ({ height }) => (
  <AbsoluteFill
    style={{
      height,
      background: COLOR.bg,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 44,
    }}
  >
    {PHONES.map((src) => (
      <div
        key={src}
        style={{
          width: PHONE.width,
          height: PHONE.height,
          border: `${PHONE.border}px solid #2a2340`,
          borderRadius: 26,
          overflow: "hidden",
          background: "#000",
        }}
      >
        <Img src={src} style={{ width: "100%", display: "block" }} />
      </div>
    ))}
  </AbsoluteFill>
);

export const EndCard: FC = () => (
  <AbsoluteFill
    style={{
      background: COLOR.bg,
      fontFamily,
      color: COLOR.fg,
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
    }}
  >
    <div style={{ transform: "scale(0.62)", height: 150, marginTop: -40 }}>
      <Mark frame={999} />
    </div>
    <div style={{ fontSize: 76, fontWeight: 600, marginTop: 4 }}>Stagehand</div>
    <div style={{ fontSize: 25, color: COLOR.dim, marginTop: 14 }}>
      The companion module works with the{" "}
      <span style={{ color: COLOR.warm }}>Stagehand</span> Chrome extension
    </div>
    <div style={{ fontSize: 25, color: COLOR.dim, marginTop: 4 }}>
      and the Stagehand Android app.
    </div>
  </AbsoluteFill>
);
