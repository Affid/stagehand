// The repeating parts of cut B's rhythm section, as small generators.

import { hits, line, range } from "../score/build.mjs";

// 0.3 s at 120 BPM.
const WHOOSH_BEATS = 0.6;

/** Kick on every beat, clap on beats two and four, hi-hat on the off-beats. */
export function groove(from, to, level = 1) {
  const beats = range(from, to, 1);
  return [
    ...hits("punch", beats, 0.8 * level),
    ...hits(
      "clap",
      beats.filter((beat) => (beat - from) % 2 === 1),
      0.7 * level,
    ),
    ...hits("hat", range(from + 0.5, to, 1), 0.5 * level),
  ];
}

/** Two beats of bouncing bass: root, a pushed root, then the octave. */
export function bounceHalf(start, root, octave, vel = 0.7) {
  return line("bounce", [
    [start, 0.5, root, vel],
    [start + 0.75, 0.25, root, vel - 0.1],
    [start + 1.5, 0.5, octave, vel - 0.05],
  ]);
}

/**
 * A scene change in the picture (one stage set hauled up, the next dropped
 * in): a short, quiet upward sweep of noise that ends exactly on the beat.
 */
export function whoosh(beat) {
  return line("riser", [[beat - WHOOSH_BEATS, WHOOSH_BEATS, "C4", 0.3]]);
}

/** Two extra claps on the last two sixteenths before a section starts. */
export function clapFill(nextSection) {
  return hits(
    "clap",
    [nextSection - 0.5, nextSection - 0.25],
    (index) => 0.55 + 0.1 * index,
  );
}
