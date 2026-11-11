// Cut B, in frames: seventeen two-second bars at 120 beats a minute, every
// scene and every landing on a beat. The score (video/music, cut B) marks
// the same times.
import { sec } from "../motion";

export const B_SCENES = {
  intro: { from: sec(0), frames: sec(4) },
  sort: { from: sec(4), frames: sec(4) },
  library: { from: sec(8), frames: sec(4) },
  devices: { from: sec(12), frames: sec(4) },
  world: { from: sec(16), frames: sec(4) },
  queue: { from: sec(20), frames: sec(4) },
  review: { from: sec(24), frames: sec(4) },
  recap: { from: sec(28), frames: sec(2) },
  lockup: { from: sec(30), frames: sec(4) },
} as const;

export const B_TOTAL_FRAMES = sec(34);

/** A scene's panel is hauled up from this frame of the scene. */
export const HAUL = 112;
