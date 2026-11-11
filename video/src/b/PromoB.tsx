// Cut B: the same real pages as the first cut, at the pace of a product
// film. Thirty seconds, cut on the beat.
import type { FC } from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { ease } from "../motion";
import { QueueB, ReviewB } from "./Change";
import { DevicesB } from "./Devices";
import { LibraryB, WorldB } from "./Features";
import { Intro } from "./Intro";
import { Bug } from "./kit";
import { Lockup, Recap } from "./Outro";
import { Sandbag } from "./rig";
import { Sort } from "./Sort";
import { B_SCENES } from "./timeline";

export type MusicB = "b-sampled" | "b-synth" | "none";

// A type, not an interface: Remotion wants props it can index by any name.
export type PromoBProps = {
  /** Which rendering of cut B's score to lay under the picture. */
  readonly music: MusicB;
};

const SCENES = [
  [B_SCENES.intro, Intro],
  [B_SCENES.sort, Sort],
  [B_SCENES.library, LibraryB],
  [B_SCENES.devices, DevicesB],
  [B_SCENES.world, WorldB],
  [B_SCENES.queue, QueueB],
  [B_SCENES.review, ReviewB],
  [B_SCENES.recap, Recap],
  [B_SCENES.lockup, Lockup],
] as const;

/** The corner name: on from the first frame, away for the two name cards. */
function bugOpacity(frame: number): number {
  const intro = 1 - ease(frame, 54, 60);
  const working =
    ease(frame, B_SCENES.library.from, B_SCENES.library.from + 8) *
    (1 - ease(frame, B_SCENES.lockup.from - 4, B_SCENES.lockup.from));
  return Math.max(intro, working);
}

export const PromoB: FC<PromoBProps> = ({ music }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#0b0a12" }}>
      {music !== "none" && (
        <Audio src={staticFile(`audio/music-${music}.m4a`)} />
      )}
      {SCENES.map(([scene, Scene]) => (
        <Sequence
          key={scene.from}
          from={scene.from}
          durationInFrames={scene.frames}
        >
          <Scene />
        </Sequence>
      ))}
      <Sandbag />
      <Bug opacity={bugOpacity(frame)} />
    </AbsoluteFill>
  );
};
