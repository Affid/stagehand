// Cut B, 16.0-30.0 s (beats 32-60): the thinner "queue" passage with its
// click at 17.0 s, the build with accents at 20.5, 21.5 and 22.5 s and a
// riser while the drums drop out, the recap in eighths, and the final hit at
// 26.0 s with one quiet echo of the hook.

import { chords, hits, line, range, steps } from "../score/build.mjs";
import { clapFill, groove } from "./groove.mjs";

// A sparser kick (none on beat 34), no clap, quiet hats; the mallet leaves a
// hole around beat 34 so the click sits alone.
const queue = [
  ...hits("punch", [32, 33, 36, 38], 0.75),
  ...hits("hat", range(32.5, 40, 1), 0.3),
  ...chords("pad", [
    [32, 4, "A3 C#4 E4", 0.45],
    [36, 4, "F#3 A3 C#4 E4", 0.45],
  ]),
  ...line("bounce", [
    [32, 3.5, "A1", 0.65],
    [36, 3.5, "F#2", 0.65],
  ]),
  ...steps(
    "mallet",
    32,
    0.5,
    "E5 C#5 A4 - - C#5 A4 C#5 E5 C#5 A4 C#5 E5 C#5 F#5 C#5",
    { vel: 0.5, velEnd: 0.5 },
  ),
  ...hits("click", [34], 0.9),
  ...line("bell", [[34, 2, "E6", 0.4]]),
  ...chords("piano", [[37, 0.5, "F#4 A4 C#5 E5", 0.7]]),
  ...line("bell", [[37, 2, "C#6", 0.45]]),
  ...hits("clap", [37, 39.5], 0.6),
];

// A B pedal under three rising triads; the kick and hats stop two beats
// before the recap and a riser and a mallet run fill the gap.
const build = [
  ...hits("punch", range(40, 46, 1), 0.8),
  ...hits("hat", range(40.5, 46, 0.5), (index) => 0.35 + 0.02 * index),
  ...hits("clap", [41, 43, 45], 0.75),
  ...chords("piano", [
    [40, 0.5, "B3 E4 F#4", 0.7],
    [41, 0.5, "A4 C#5 E5", 0.7],
    [43, 0.5, "B4 D#5 F#5", 0.75],
    [45, 0.5, "C#5 E5 G#5", 0.8],
  ]),
  ...line("bell", [
    [41, 1, "E6", 0.4],
    [43, 1, "F#6", 0.42],
    [45, 1, "G#6", 0.45],
  ]),
  ...chords("pad", [[40, 8, "B3 E4 F#4", 0.5, { attack: 0.3 }]]),
  ...steps("bounce", 40, 0.5, "B1 B1 B1 B1 B1 B1 B1 B1 B1 B1 B1 B1", {
    vel: 0.55,
    velEnd: 0.75,
    dur: 0.3,
  }),
  ...line("riser", [[46, 2, "C4", 0.9]]),
  ...steps("mallet", 46, 0.25, "B4 C#5 E5 F#5 G#5 B5 C#6 E6", {
    vel: 0.4,
    velEnd: 0.8,
  }),
];

// Six hits a quarter of a second apart, then a four-note fill up to the tonic.
const recap = [
  ...groove(48, 52),
  ...clapFill(52),
  ...steps("pluck", 48, 0.5, "G#5 B5 A5 C#6 B5 D#6", {
    vel: 0.8,
    velEnd: 0.8,
    dur: 0.4,
  }),
  ...chords("piano", [
    [48, 0.25, "E4 G#4 B4", 0.75],
    [48.5, 0.25, "E4 G#4 B4", 0.65],
    [49, 0.25, "E4 A4 C#5", 0.75],
    [49.5, 0.25, "E4 A4 C#5", 0.65],
    [50, 0.25, "F#4 B4 D#5", 0.75],
    [50.5, 0.25, "F#4 B4 D#5", 0.65],
  ]),
  ...steps("bounce", 48, 0.5, "E2 E2 A1 A1 B1 B1 B1 B1", {
    vel: 0.7,
    velEnd: 0.75,
    dur: 0.3,
  }),
  ...steps("mallet", 51, 0.25, "F#5 B5 C#6 D#6", { vel: 0.6, velEnd: 0.8 }),
  ...steps("pluck", 51, 0.25, "F#5 B5 C#6 D#6", { vel: 0.6, velEnd: 0.8 }),
];

const finalHit = [
  ...hits("punch", [52], 0.9),
  ...hits("clap", [52], 0.7),
  ...chords("piano", [[52, 4, "E3 B3 E4 G#4 B4 E5", 0.8]]),
  ...chords("pad", [[52, 3, "E3 B3 E4 G#4", 0.55, { attack: 0.05 }]]),
  ...chords("mallet", [[52, 1, "E5 B5 E6", 0.75]]),
  ...line("pluck", [[52, 1, "E6", 0.8]]),
  ...line("bell", [[52, 2, "E6", 0.5]]),
  ...line("bounce", [[52, 3, "E2", 0.75]]),
  // The hook's opening, once, at half strength; nothing new after 28.0 s.
  ...line("pluck", [
    [54, 0.5, "G#5", 0.42],
    [54.5, 0.5, "B5", 0.36],
    [55.25, 0.25, "G#5", 0.34],
    [55.5, 0.5, "F#5", 0.36],
    [56, 2, "E5", 0.42],
  ]),
  ...line("bell", [[56, 2, "E6", 0.3]]),
];

export const closing = [...queue, ...build, ...recap, ...finalHit];
