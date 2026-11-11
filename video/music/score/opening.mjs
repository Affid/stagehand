// 0.0-8.0 s (beats 0-16): the still, cluttered page; the lift-off at 2.0 s;
// the cards sorting themselves 3.0-6.5 s; the landing at 7.0 s.

import { chords, hits, line, range, steps } from "./build.mjs";

const still = [
  // The pad opens quickly so the film is not silent on its first frame.
  ...chords("pad", [[0, 4, "D3 A3 E4", 0.5, { attack: 0.12 }]]),
  ...line("bass", [[0, 4, "D2", 0.5]]),
  ...line("piano", [
    [0, 2, "A4", 0.45],
    [2, 2, "E5", 0.4],
  ]),
];

const liftOff = [
  ...chords("pad", [[4, 4, "G3 B3 D4 A4", 0.5, { attack: 0.25 }]]),
  ...line("bass", [[4, 4, "G2", 0.55]]),
  ...chords("piano", [[4, 3, "D5 A5", 0.55]]),
  ...line("bell", [[4, 2, "D6", 0.35]]),
];

// The one busy moment: eighths, then sixteenths climbing in overlapping
// groups of four, then a sextuplet sweep that tops out as the last card lands.
const sortingRun = [
  ...chords("pad", [[8, 6, "A3 D4 E4", 0.5]]),
  ...line("bass", [[8, 6, "A2", 0.55]]),
  ...steps("mallet", 6, 0.5, "A3 D4 E4 F#4", { vel: 0.35, velEnd: 0.45 }),
  ...steps(
    "mallet",
    8,
    0.25,
    "E4 F#4 A4 F#4 F#4 A4 B4 A4 A4 B4 D5 B4 B4 D5 E5 D5",
    {
      vel: 0.42,
      velEnd: 0.65,
    },
  ),
  ...steps("mallet", 12, 1 / 6, "B4 D5 E5 F#5 A5 B5", {
    vel: 0.65,
    velEnd: 0.78,
  }),
  ...line("mallet", [[13, 1, "D6", 0.8]]),
  ...line("bell", [[13, 2, "D6", 0.4]]),
  ...hits("shaker", range(8, 13, 0.25), (index) => 0.15 + 0.015 * index),
];

const landing = [
  ...chords("pad", [[14, 2, "D3 A3 D4 F#4", 0.5, { attack: 0.08 }]]),
  ...line("bass", [[14, 2, "D2", 0.65]]),
  ...chords("piano", [[14, 2, "D3 A3 F#4 A4 D5", 0.5]]),
  ...chords("mallet", [[14, 1, "D5 F#5", 0.7]]),
  ...line("bell", [[14, 2, "D6", 0.4]]),
  ...hits("kick", [14], 0.6),
];

export const opening = [...still, ...liftOff, ...sortingRun, ...landing];
