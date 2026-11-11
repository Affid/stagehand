import type { FC } from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { ease } from "./motion";
import { Caption, CaptionShade } from "./parts/Caption";
import { ByWorld } from "./scenes/ByWorld";
import { EndCard } from "./scenes/EndCard";
import { Library } from "./scenes/Library";
import { Queue } from "./scenes/Queue";
import { Review } from "./scenes/Review";
import { SceneChange } from "./scenes/SceneChange";
import { CAPTIONS, SCENES } from "./timeline";

/** The review stays underneath while the end card fades in over it. */
const END_OVERLAP = 14;

export type Music = "sampled" | "synth" | "simple" | "none";

// A type, not an interface: Remotion wants props it can index by any name.
export type PromoProps = {
  /** Which rendering of the score to lay under the picture (video/music). */
  readonly music: Music;
};

export const Promo: FC<PromoProps> = ({ music }) => {
  const frame = useCurrentFrame();
  const shade = 1 - ease(frame, SCENES.end.from, SCENES.end.from + 10);
  return (
    <AbsoluteFill style={{ background: "#0c0b14" }}>
      {music !== "none" && (
        <Audio src={staticFile(`audio/music-${music}.m4a`)} />
      )}
      <Sequence
        from={SCENES.change.from}
        durationInFrames={SCENES.change.frames}
      >
        <SceneChange />
      </Sequence>
      <Sequence
        from={SCENES.library.from}
        durationInFrames={SCENES.library.frames}
      >
        <Library />
      </Sequence>
      <Sequence
        from={SCENES.byWorld.from}
        durationInFrames={SCENES.byWorld.frames}
      >
        <ByWorld />
      </Sequence>
      <Sequence from={SCENES.queue.from} durationInFrames={SCENES.queue.frames}>
        <Queue />
      </Sequence>
      <Sequence
        from={SCENES.review.from}
        durationInFrames={SCENES.review.frames + END_OVERLAP}
      >
        <Review />
      </Sequence>
      <CaptionShade opacity={shade} />
      {CAPTIONS.map((line) => (
        <Caption key={line.text} line={line} />
      ))}
      <Sequence from={SCENES.end.from} durationInFrames={SCENES.end.frames}>
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
};
