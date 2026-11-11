// Cut B, 0.0-8.0 s (beats 0-16): two type slams, the name reveal at 2.0 s,
// a riser, then the drop at 4.0 s with eight rising notes as the folder
// piles land (4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.25, 7.5 s).

import { chords, hits, line, steps } from "../score/build.mjs";
import { bounceHalf, clapFill, groove } from "./groove.mjs";

// Bare fifths, then a suspended chord: nothing settles until the name lands.
const slams = [
  ...hits("punch", [0, 2], 0.85),
  ...chords("piano", [
    [0, 0.5, "E3 B3 E4 B4", 0.75],
    [2, 0.5, "B2 F#3 B3 E4 F#4", 0.75],
  ]),
  ...line("mallet", [
    [0, 1, "E5", 0.7],
    [2, 1, "F#5", 0.7],
  ]),
  ...line("bounce", [
    [0, 1.5, "E2", 0.75],
    [2, 1.5, "B1", 0.75],
  ]),
  ...chords("pad", [[0, 4, "E3 B3", 0.4, { attack: 1.5 }]]),
  ...line("riser", [[2, 2, "C4", 0.45]]),
];

const reveal = [
  ...hits("punch", [4], 0.9),
  ...hits("clap", [4], 0.75),
  ...chords("piano", [[4, 3, "E3 B3 E4 G#4 B4 F#5", 0.8]]),
  ...chords("pad", [[4, 4, "E3 B3 E4 G#4", 0.6, { attack: 0.05 }]]),
  ...chords("mallet", [[4, 1, "G#5 B5", 0.75]]),
  ...line("bell", [[4, 2, "E6", 0.5]]),
  ...line("bounce", [[4, 3, "E2", 0.75]]),
  ...line("riser", [[6, 2, "C4", 0.8]]),
  ...steps("mallet", 7, 0.25, "B4 E5 F#5 G#5", { vel: 0.4, velEnd: 0.7 }),
];

// One note per folder pile, climbing the E major pentatonic.
const LANDINGS = [
  [9, "B4"],
  [10, "C#5"],
  [11, "E5"],
  [12, "F#5"],
  [13, "G#5"],
  [14, "B5"],
  [14.5, "C#6"],
  [15, "E6"],
];
const landings = LANDINGS.flatMap(([beat, pitch], index) => [
  ...line("mallet", [[beat, 0.5, pitch, 0.6 + 0.035 * index]]),
  ...line("pluck", [[beat, 0.5, pitch, 0.6 + 0.035 * index]]),
]);

const drop = [
  ...groove(8, 16),
  ...clapFill(16),
  ...chords("piano", [[8, 0.5, "E4 G#4 B4", 0.75]]),
  ...chords("pad", [
    [8, 4, "E3 B3 E4 G#4", 0.45],
    [12, 4, "A3 C#4 E4", 0.45],
  ]),
  ...bounceHalf(8, "E2", "E3"),
  ...bounceHalf(10, "E2", "E3"),
  ...bounceHalf(12, "A1", "A2"),
  ...bounceHalf(14, "A1", "A2"),
  ...landings,
];

export const opening = [...slams, ...reveal, ...drop];
