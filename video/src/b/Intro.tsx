// Bars 1 and 2: the problem in two lines over Foundry's own list rushing
// past, then the name.
import type { FC } from "react";
import { AbsoluteFill, Img, useCurrentFrame } from "remotion";
import { capture, shot } from "../data";
import { lerp } from "../motion";
import { Mark } from "../scenes/EndCard";
import { COLOR, fontFamily } from "../theme";
import { Backdrop, BigType, Burst, hit, rush, snap } from "./kit";

const { cards, chrome } = capture.stock;
const LIST = chrome.list;
const COUNT = cards.length;
const NAME_AT = 60;

/** Foundry's module list, laid back like a floor and running under the type. */
const RushingList: FC = () => {
  const frame = useCurrentFrame();
  const gone = rush(frame, NAME_AT - 4, 6);
  if (gone >= 1) return null;
  const scroll = 420 + frame * 9 + frame * frame * 0.16;
  return (
    <AbsoluteFill
      style={{
        opacity: 0.7 * (1 - gone),
        transform: `scale(${1 + gone * 0.5})`,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 960 - LIST[2],
          top: -260,
          width: LIST[2],
          transformOrigin: "50% 40%",
          transform:
            "perspective(1500px) rotateX(54deg) rotateZ(-9deg) scale(2)",
        }}
      >
        <div style={{ transform: `translateY(${-scroll}px)` }}>
          {cards.map((card) => (
            <Img
              key={card.id}
              src={shot(`stock/cards/${card.id}.png`)}
              style={{
                position: "absolute",
                left: card.rect[0] - LIST[0],
                top: card.rect[1] - LIST[1] + 520,
                width: card.rect[2],
                height: card.rect[3],
              }}
            />
          ))}
        </div>
      </div>
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, #0b0a12 0%, rgba(11,10,18,0) 30%, rgba(11,10,18,0) 55%, #0b0a12 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

const Name: FC = () => {
  const frame = useCurrentFrame();
  if (frame < NAME_AT) return null;
  const mark = snap(frame, NAME_AT, 12);
  const leave = rush(frame, 112, 8);
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        fontFamily,
        color: COLOR.fg,
        opacity: 1 - leave,
        transform: `scale(${1 + leave * 0.6 + (frame - NAME_AT) * 0.0012})`,
      }}
    >
      <Burst x={960} y={400} amount={(frame - NAME_AT) / 22} size={900} />
      <div style={{ transform: `scale(${lerp(2.2, 1, mark)})`, opacity: mark }}>
        <Mark frame={frame - NAME_AT + 6} />
      </div>
      <div
        style={{
          position: "relative",
          width: 1920,
          height: 260,
          marginTop: 30,
        }}
      >
        <BigType
          line={{
            text: "Meet Stagehand.",
            at: NAME_AT + 3,
            until: 200,
            accent: ["stagehand"],
          }}
          size={210}
          style={{ left: 0, right: 0, textAlign: "center" }}
        />
      </div>
    </AbsoluteFill>
  );
};

export const Intro: FC = () => {
  const frame = useCurrentFrame();
  const TYPE = { left: 120, top: 380 } as const;
  return (
    <AbsoluteFill>
      <Backdrop />
      <RushingList />
      <BigType
        line={{ text: `${COUNT} modules.`, at: 0, until: 30, still: true }}
        size={250}
        style={TYPE}
      />
      <BigType
        line={{
          text: "One long list.",
          at: 30,
          until: NAME_AT,
          accent: ["long"],
        }}
        size={250}
        style={TYPE}
      />
      <Name />
      <AbsoluteFill
        style={{ background: "#fff", opacity: 0.1 * hit(frame, NAME_AT, 8) }}
      />
    </AbsoluteFill>
  );
};
