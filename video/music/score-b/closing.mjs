// Cut B, 20.0-34.0 s (beats 40-68): the thinner "queue" passage with its
// click at 21.0 s, the build with accents at 24.5, 25.5 and 26.5 s and a
// riser while the drums drop out, the recap in eighths, and the final hit at
// 30.0 s with one quiet echo of the hook.

import { chords, hits, line, range, steps } from "../score/build.mjs";
import { clapFill, groove } from "./groove.mjs";

// A sparser kick (none on beat 42), no clap, quiet hats; the mallet leaves a
// hole around beat 42 so the click sits alone.
const queue = [
  ...hits("punch", [40, 41, 44, 46], 0.75),
  ...hits("hat", range(40.5, 48, 1), 0.3),
  ...chords("pad", [
    [40, 4, "A3 C#4 E4", 0.45],
    [44, 4, "F#3 A3 C#4 E4", 0.45],
  ]),
  ...line("bounce", [
    [40, 3.5, "A1", 0.65],
    [44, 3.5, "F#2", 0.65],
  ]),
  ...steps(
    "mallet",
    40,
    0.5,
    "E5 C#5 A4 - - C#5 A4 C#5 E5 C#5 A4 C#5 E5 C#5 F#5 C#5",
    { vel: 0.5, velEnd: 0.5 },
  ),
  ...hits("click", [42], 0.9),
  ...line("bell", [[42, 2, "E6", 0.4]]),
  ...chords("piano", [[45, 0.5, "F#4 A4 C#5 E5", 0.7]]),
  ...line("bell", [[45, 2, "C#6", 0.45]]),
  ...hits("clap", [45, 47.5], 0.6),
];

// A B pedal under three rising triads; the kick and hats stop two beats
// before the recap and a riser and a mallet run fill the gap.
const build = [
  ...hits("punch", range(48, 54, 1), 0.8),
  ...hits("hat", range(48.5, 54, 0.5), (index) => 0.35 + 0.02 * index),
  ...hits("clap", [49, 51, 53], 0.75),
  ...chords("piano", [
    [48, 0.5, "B3 E4 F#4", 0.7],
    [49, 0.5, "A4 C#5 E5", 0.7],
    [51, 0.5, "B4 D#5 F#5", 0.75],
    [53, 0.5, "C#5 E5 G#5", 0.8],
  ]),
  ...line("bell", [
    [49, 1, "E6", 0.4],
    [51, 1, "F#6", 0.42],
    [53, 1, "G#6", 0.45],
  ]),
  ...chords("pad", [[48, 8, "B3 E4 F#4", 0.5, { attack: 0.3 }]]),
  ...steps("bounce", 48, 0.5, "B1 B1 B1 B1 B1 B1 B1 B1 B1 B1 B1 B1", {
    vel: 0.55,
    velEnd: 0.75,
    dur: 0.3,
  }),
  ...line("riser", [[54, 2, "C4", 0.9]]),
  ...steps("mallet", 54, 0.25, "B4 C#5 E5 F#5 G#5 B5 C#6 E6", {
    vel: 0.4,
    velEnd: 0.8,
  }),
];

// Six hits a quarter of a second apart, then a four-note fill up to the tonic.
const recap = [
  ...groove(56, 60),
  ...clapFill(60),
  ...steps("pluck", 56, 0.5, "G#5 B5 A5 C#6 B5 D#6", {
    vel: 0.8,
    velEnd: 0.8,
    dur: 0.4,
  }),
  ...chords("piano", [
    [56, 0.25, "E4 G#4 B4", 0.75],
    [56.5, 0.25, "E4 G#4 B4", 0.65],
    [57, 0.25, "E4 A4 C#5", 0.75],
    [57.5, 0.25, "E4 A4 C#5", 0.65],
    [58, 0.25, "F#4 B4 D#5", 0.75],
    [58.5, 0.25, "F#4 B4 D#5", 0.65],
  ]),
  ...steps("bounce", 56, 0.5, "E2 E2 A1 A1 B1 B1 B1 B1", {
    vel: 0.7,
    velEnd: 0.75,
    dur: 0.3,
  }),
  ...steps("mallet", 59, 0.25, "F#5 B5 C#6 D#6", { vel: 0.6, velEnd: 0.8 }),
  ...steps("pluck", 59, 0.25, "F#5 B5 C#6 D#6", { vel: 0.6, velEnd: 0.8 }),
];

const finalHit = [
  ...hits("punch", [60], 0.9),
  ...hits("clap", [60], 0.7),
  ...chords("piano", [[60, 4, "E3 B3 E4 G#4 B4 E5", 0.8]]),
  ...chords("pad", [[60, 3, "E3 B3 E4 G#4", 0.55, { attack: 0.05 }]]),
  ...chords("mallet", [[60, 1, "E5 B5 E6", 0.75]]),
  ...line("pluck", [[60, 1, "E6", 0.8]]),
  ...line("bell", [[60, 2, "E6", 0.5]]),
  ...line("bounce", [[60, 3, "E2", 0.75]]),
  // The hook's opening, once, at half strength; nothing new after 32.0 s.
  ...line("pluck", [
    [62, 0.5, "G#5", 0.42],
    [62.5, 0.5, "B5", 0.36],
    [63.25, 0.25, "G#5", 0.34],
    [63.5, 0.5, "F#5", 0.36],
    [64, 2, "E5", 0.42],
  ]),
  ...line("bell", [[64, 2, "E6", 0.3]]),
];

export const closing = [...queue, ...build, ...recap, ...finalHit];
