// One line of caption at the foot of the frame, its words rising in one
// after another. The video is watched muted: these carry the story.
import type { FC } from "react";
import { useCurrentFrame } from "remotion";
import { ease, pop } from "../motion";
import { COLOR, fontFamily } from "../theme";

export interface CaptionLine {
  readonly text: string;
  /** Global frames the line is on screen for. */
  readonly from: number;
  readonly to: number;
  /** Words drawn in amber. */
  readonly accent?: readonly string[];
  /** Already in place on its first frame (the thumbnail). */
  readonly still?: boolean;
  readonly size?: number;
}

const WORD_GAP = 2;
const FADE = 8;
const bare = (word: string): string =>
  word.toLowerCase().replace(/[^a-z0-9']/g, "");

export const Caption: FC<{ readonly line: CaptionLine }> = ({ line }) => {
  const frame = useCurrentFrame();
  if (frame < line.from || frame >= line.to) return null;
  const out = 1 - ease(frame, line.to - FADE, line.to);
  const size = line.size ?? 66;
  return (
    <div
      style={{
        position: "absolute",
        left: 96,
        right: 96,
        bottom: 64,
        fontFamily,
        fontSize: size,
        fontWeight: 600,
        lineHeight: 1.15,
        color: COLOR.fg,
        opacity: out,
        textShadow: "0 2px 18px rgba(8,7,14,0.9)",
      }}
    >
      {line.text.split(" ").map((word, i) => {
        const t = line.still ? 1 : pop(frame, line.from + i * WORD_GAP, 15);
        const accent = line.accent?.includes(bare(word)) ?? false;
        return (
          <span
            key={`${word}-${i}`}
            style={{
              display: "inline-block",
              marginRight: size * 0.26,
              opacity: Math.min(1, t * 1.4),
              transform: `translateY(${(1 - t) * size * 0.55}px)`,
              color: accent ? COLOR.warm : undefined,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

/** The soft shade captions sit on. */
export const CaptionShade: FC<{ readonly opacity: number }> = ({ opacity }) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: 330,
      opacity,
      background:
        "linear-gradient(180deg, rgba(12,11,20,0) 0%, rgba(12,11,20,0.9) 62%, rgba(12,11,20,0.96) 100%)",
    }}
  />
);
