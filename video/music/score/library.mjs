// 8.0-22.0 s (beats 16-44): the groove and the theme. Bars 5-8 state the
// theme over D, Bm7, Gmaj7, Asus4-A; bars 9-11 lift it over Gmaj7, D/F#,
// Em7-A7sus4. The theme's notes at beats 16, 21 and 26 are the film's
// "Folders", "Tags" and "Notes" cuts (8.0, 10.5, 13.0 s), each doubled by a bell.

import { chords, hits, line, range, steps } from "./build.mjs";

const theme = line("piano", [
  [16, 1.5, "F#5", 0.6],
  [17.5, 0.5, "E5", 0.45],
  [18, 1, "D5", 0.5],
  [19, 1, "A4", 0.45],
  [20, 1, "B4", 0.5],
  [21, 1, "D5", 0.6],
  [22, 1.5, "F#5", 0.55],
  [23.5, 0.5, "E5", 0.45],
  [24, 1, "D5", 0.5],
  [25, 1, "E5", 0.5],
  [26, 1.5, "G5", 0.62],
  [27.5, 0.5, "F#5", 0.48],
  [28, 2, "E5", 0.55],
  [30, 1, "C#5", 0.45],
  [31, 1, "E5", 0.5],
]);

const themeLifted = line("piano", [
  [32, 1.5, "A5", 0.62],
  [33.5, 0.5, "G5", 0.48],
  [34, 1, "F#5", 0.52],
  [35, 1, "D5", 0.48],
  [36, 1, "E5", 0.5],
  [37, 1, "F#5", 0.52],
  [38, 1.5, "A5", 0.6],
  [39.5, 0.5, "F#5", 0.48],
  [40, 1.5, "G5", 0.56],
  [41.5, 0.5, "F#5", 0.46],
  [42, 2, "E5", 0.5],
]);

const accents = line("bell", [
  [16, 2, "F#6", 0.4],
  [21, 2, "D6", 0.4],
  [26, 2, "G6", 0.4],
]);

const ostinatoBars = [
  "D4 A4 F#4 A4 E5 A4 F#4 A4",
  "B3 A4 F#4 A4 D5 A4 F#4 A4",
  "B3 G4 D4 G4 D5 G4 D4 G4",
  "A3 E4 D4 E4 A4 E4 C#4 E4",
  "D4 B4 G4 B4 F#5 B4 G4 B4",
  "D4 A4 F#4 A4 F#5 A4 F#4 A4",
  "E4 B4 G4 B4 E4 A4 D5 A4",
];
const ostinato = ostinatoBars.flatMap((bar, index) =>
  steps("mallet", 16 + 4 * index, 0.5, bar, { vel: 0.5, velEnd: 0.42 }),
);

const harmony = chords("pad", [
  [16, 4, "D3 A3 E4 F#4", 0.5],
  [20, 4, "B2 F#3 A3 D4", 0.5],
  [24, 4, "G3 B3 D4 F#4", 0.5],
  [28, 2, "A3 D4 E4", 0.5],
  [30, 2, "A3 C#4 E4", 0.5],
  [32, 4, "G3 B3 D4 F#4", 0.55],
  [36, 4, "F#3 A3 D4", 0.55],
  [40, 2, "E3 G3 B3 D4", 0.55],
  [42, 2, "A3 D4 E4 G4", 0.55],
]);

const bass = line("bass", [
  [16, 2, "D2", 0.6],
  [18.5, 1.5, "A2", 0.5],
  [20, 2, "B2", 0.6],
  [22.5, 1.5, "F#2", 0.5],
  [24, 2, "G2", 0.6],
  [26.5, 1.5, "D3", 0.5],
  [28, 2, "A2", 0.6],
  [30.5, 1.5, "E2", 0.5],
  [32, 2, "G2", 0.6],
  [34.5, 1.5, "D3", 0.5],
  [36, 2, "F#2", 0.6],
  [38.5, 1.5, "A2", 0.5],
  [40, 2, "E2", 0.6],
  [42, 2, "A2", 0.6],
]);

// A soft kick on beats one and three and a shaker on the eighths, the
// off-beats a little stronger: the lightest thing that still reads as a pulse.
const pulse = [
  ...hits("kick", range(16, 44, 2), 0.55),
  ...hits("shaker", range(16, 44, 0.5), (index) =>
    index % 2 === 0 ? 0.3 : 0.5,
  ),
];

export const library = [
  ...theme,
  ...themeLifted,
  ...accents,
  ...ostinato,
  ...harmony,
  ...bass,
  ...pulse,
];
