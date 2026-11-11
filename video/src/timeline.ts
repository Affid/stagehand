// The video's scenes and captions, in frames. One beat of the music is half
// a second, so every scene starts on a beat.
import { capture } from "./data";
import { sec } from "./motion";
import type { CaptionLine } from "./parts/Caption";

export const SCENES = {
  change: { from: sec(0), frames: sec(8) },
  library: { from: sec(8), frames: sec(8) },
  byWorld: { from: sec(16), frames: sec(6) },
  queue: { from: sec(22), frames: sec(6) },
  review: { from: sec(28), frames: sec(6) },
  end: { from: sec(34), frames: sec(7) },
} as const;

export const TOTAL_FRAMES = sec(41);

const COUNT = capture.library.cards.length;
const BIG = 104;

export const CAPTIONS: readonly CaptionLine[] = [
  {
    text: "Stagehand: a calmer Setup screen for Foundry VTT",
    from: 0,
    to: sec(2.1),
    accent: ["stagehand"],
    still: true,
  },
  { text: `Same server. Same ${COUNT} modules.`, from: sec(2.4), to: sec(6.1) },
  {
    text: "Stagehand puts them in order.",
    from: sec(6.3),
    to: sec(7.9),
    accent: ["stagehand"],
  },
  { text: "Folders.", from: sec(8), to: sec(10.4), size: BIG },
  { text: "Tags.", from: sec(10.5), to: sec(12.9), size: BIG },
  { text: "And your own notes.", from: sec(13), to: sec(15.8), size: BIG },
  {
    text: "See which world uses which module.",
    from: sec(16.4),
    to: sec(21.8),
    accent: ["world", "module"],
  },
  {
    text: "Change a world's modules from Setup.",
    from: sec(22.3),
    to: sec(24.4),
  },
  {
    text: "The change waits for the next launch.",
    from: sec(24.7),
    to: sec(27.8),
    accent: ["waits"],
  },
  {
    text: "Review it before you launch.",
    from: sec(28.2),
    to: sec(33.7),
    accent: ["review"],
  },
];
