// 22.0-41.0 s (beats 44-82): the thin "queue a change" passage with its
// toggle at 24.5 s, the suspended "review" passage with a swell at 29.5 s,
// then the resolution at 34.5 s and the theme once more at half speed.

import { chords, hits, line, steps } from "./build.mjs";

const queue = [
  ...chords("pad", [
    [44, 4, "B2 F#3 A3 D4", 0.45],
    [48, 4, "G3 B3 D4", 0.45],
    [52, 4, "E3 G3 B3 F#4", 0.45],
  ]),
  ...line("bass", [
    [44, 4, "B2", 0.45],
    [48, 4, "G2", 0.45],
    [52, 4, "E2", 0.45],
  ]),
  ...line("mallet", [
    [44, 1, "F#4", 0.4],
    [45.5, 1, "A4", 0.36],
    [47, 1, "D5", 0.4],
    [48, 1, "G4", 0.4],
    [51, 1, "D5", 0.38],
    [52, 1, "E4", 0.4],
    [53.5, 1, "G4", 0.36],
    [55, 0.5, "B4", 0.38],
    [55.5, 0.5, "F#5", 0.36],
  ]),
  ...line("piano", [
    [44, 3, "F#5", 0.42],
    [47, 1, "D5", 0.36],
    [50, 2, "B4", 0.36],
    [52, 2, "E5", 0.4],
    [54, 2, "G5", 0.4],
  ]),
  // The toggle: one high mallet note with a bell on top, alone in its beat.
  ...line("mallet", [[49, 1, "B5", 0.7]]),
  ...line("bell", [[49, 2, "F#6", 0.42]]),
];

// A9sus4 over a held A: nothing resolves until the logo lands.
const review = [
  ...chords("pad", [[56, 13, "A2 E3 G3 B3 D4", 0.42]]),
  ...chords("pad", [[57, 5, "E4 G4 B4 D5", 0.6, { attack: 1.0 }]]),
  ...line("bass", [
    [56, 4, "A2", 0.45],
    [60, 4, "A2", 0.45],
    [64, 4, "A2", 0.45],
    [68, 1, "A2", 0.5],
  ]),
  ...steps(
    "mallet",
    56,
    0.5,
    "A4 E5 D5 E5 A4 E5 D5 E5 A4 E5 D5 E5 B4 E5 D5 E5 A4 E5 D5 E5 B4 E5 G5 E5",
    {
      vel: 0.28,
      velEnd: 0.44,
    },
  ),
  // The dialog opens: a slow rolled chord on top of the pad's swell.
  ...line("piano", [
    [59, 4, "E4", 0.36],
    [59.15, 4, "G4", 0.36],
    [59.3, 4, "B4", 0.38],
    [59.45, 4, "D5", 0.4],
    [62, 1, "B4", 0.38],
    [63, 1, "D5", 0.4],
    [64, 1.5, "E5", 0.44],
    [65.5, 2.5, "G5", 0.46],
  ]),
  ...steps("mallet", 68, 0.5, "A4 C#5", { vel: 0.5, velEnd: 0.58 }),
];

const endCard = [
  ...chords("pad", [
    [69, 3, "D3 A3 D4 F#4", 0.5, { attack: 0.1 }],
    [72, 4, "D3 G3 B3 D4", 0.5],
    [76, 1.5, "D3 A3 D4 F#4", 0.5, { attack: 0.3 }],
  ]),
  ...line("bass", [
    [69, 3, "D2", 0.65],
    [72, 4, "D2", 0.5],
    [76, 2, "D2", 0.5],
  ]),
  ...hits("kick", [69], 0.6),
  ...line("bell", [
    [69, 2, "D6", 0.42],
    [77, 2, "D6", 0.34],
  ]),
  ...chords("piano", [[69, 1, "D3 A3 F#4 D5", 0.5]]),
  ...line("piano", [
    [70, 2, "F#5", 0.55],
    [72, 1, "E5", 0.48],
    [73, 1, "D5", 0.48],
    [74, 2, "A4", 0.44],
  ]),
  ...chords("piano", [[76, 2.5, "D3 A3 F#4 D5", 0.42]]),
  ...line("mallet", [[69, 1, "D5", 0.62]]),
  ...steps("mallet", 70, 1, "A4 D4 B4 D4 G4 D4", { vel: 0.42, velEnd: 0.34 }),
  ...line("mallet", [
    [76, 1, "D4", 0.4],
    [76.5, 1, "A4", 0.4],
    [77, 1, "F#5", 0.44],
  ]),
];

export const closing = [...queue, ...review, ...endCard];
