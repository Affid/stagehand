// Bars 7 and 8: the same Library on a computer and on a phone. The desktop
// page is the extension's, the phone's is the Android app's own screenshot
// from a device; the frames around them are drawn.
import type { FC } from "react";
import { AbsoluteFill, Img, useCurrentFrame } from "remotion";
import { shot, SHOTS } from "../data";
import { lerp } from "../motion";
import { COLOR } from "../theme";
import { Backdrop, BEAT, BigType, hit, Window } from "./kit";
import { Hung, ONE } from "./rig";
import { HAUL } from "./timeline";

const BAR = BEAT * 2;
const PHONE_SHOT = shot("phone/library.png");
const DESKTOP = { left: 110, top: 150, width: 1060 } as const;
const PHONE = { left: 1310, top: 140, width: 350 } as const;
const BEZEL = 14;
/** 14.0 s: both light up. 15.0 s: a pulse goes across and comes back. */
const LIGHT = BAR * 2;
const SYNC = BAR * 3;
const CROSSING = 11;

const glow = (frame: number): string =>
  `0 0 ${90 * hit(frame, LIGHT, 22)}px rgba(238,155,58,${0.75 * hit(frame, LIGHT, 22)})`;

const Phone: FC = () => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        padding: BEZEL,
        borderRadius: 58,
        background: "#07060b",
        boxShadow: `0 50px 120px rgba(0,0,0,0.7), 0 0 0 2px rgba(239,233,221,0.22), ${glow(frame)}`,
      }}
    >
      <Img
        src={PHONE_SHOT}
        style={{
          display: "block",
          width: PHONE.width - BEZEL * 2,
          borderRadius: 44,
        }}
      />
    </div>
  );
};

/** A dot from one device to the other along a low arc, then back. */
const SyncPulse: FC = () => {
  const frame = useCurrentFrame();
  const local = frame - SYNC;
  if (local < 0 || local >= CROSSING * 2) return null;
  const back = local >= CROSSING;
  const t = (local % CROSSING) / CROSSING;
  const from = { x: DESKTOP.left + DESKTOP.width - 40, y: 480 };
  const to = { x: PHONE.left + 40, y: 520 };
  const p = back ? 1 - t : t;
  return (
    <div
      style={{
        position: "absolute",
        left: lerp(from.x, to.x, p) - 16,
        top: lerp(from.y, to.y, p) - 110 * Math.sin(Math.PI * t) - 16,
        width: 32,
        height: 32,
        borderRadius: 16,
        background: COLOR.warm,
        boxShadow: "0 0 40px 10px rgba(238,155,58,0.6)",
      }}
    />
  );
};

const WORDS = [
  { text: "On your computer.", accent: "computer" },
  { text: "On your phone.", accent: "phone" },
  { text: "One library.", accent: "one" },
  { text: "In sync through your server.", accent: "sync" },
] as const;

export const DevicesB: FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Backdrop />
      <Hung
        inAt={0}
        left={DESKTOP.left}
        top={DESKTOP.top}
        width={DESKTOP.width}
        ropes={ONE}
      >
        <Window
          src={SHOTS.library}
          view={{ x: 0, y: 0, w: 1280, h: 720 }}
          width={DESKTOP.width}
          style={{
            position: "relative",
            boxShadow: `0 50px 120px rgba(0,0,0,0.65), 0 0 0 1.5px rgba(239,233,221,0.14), ${glow(frame)}`,
          }}
        />
      </Hung>
      <Hung
        inAt={BAR}
        left={PHONE.left}
        top={PHONE.top}
        width={PHONE.width}
        ropes={ONE}
      >
        <Phone />
      </Hung>
      <SyncPulse />
      {WORDS.map((word, i) => (
        <BigType
          key={word.text}
          line={{
            text: word.text,
            at: i * BAR,
            until: i === 3 ? HAUL + 4 : (i + 1) * BAR,
            accent: [word.accent],
          }}
          size={i === 3 ? 100 : 130}
          style={{ left: 110, top: i === 3 ? 830 : 800, width: 1160 }}
        />
      ))}
    </AbsoluteFill>
  );
};
