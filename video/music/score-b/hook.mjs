// Cut B, 8.0-12.0 and 16.0-20.0 s (beats 16-24 and 32-40): the hook over E,
// C#m7, A, B (two beats each) with chord stabs on the film's accents at 8, 9,
// 10 and 11 s; then, after the "devices" passage in devices.mjs, a variation
// a third higher over C#m7, B, A, B with the mallet doubling the pluck. The
// groove for all three passages (beats 16-40) is written here.

import { chords, line } from "../score/build.mjs";
import { bounceHalf, clapFill, groove } from "./groove.mjs";

const HOOK = [
  [16, 0.5, "G#5", 0.8],
  [16.5, 0.5, "B5", 0.65],
  [17.25, 0.25, "G#5", 0.6],
  [17.5, 0.5, "F#5", 0.65],
  [18, 1, "E5", 0.8],
  [19, 0.5, "F#5", 0.6],
  [19.5, 0.5, "G#5", 0.65],
  [20, 0.75, "C#6", 0.85],
  [20.75, 0.25, "B5", 0.6],
  [21, 0.5, "G#5", 0.65],
  [21.5, 0.5, "E5", 0.6],
  [22, 1, "F#5", 0.8],
  [23, 0.5, "B4", 0.55],
  [23.5, 0.5, "E5", 0.6],
];

const HOOK_LIFTED = [
  [32, 0.5, "B5", 0.8],
  [32.5, 0.5, "C#6", 0.65],
  [33.25, 0.25, "B5", 0.6],
  [33.5, 0.5, "G#5", 0.65],
  [34, 1, "F#5", 0.8],
  [35, 0.5, "G#5", 0.6],
  [35.5, 0.5, "B5", 0.65],
  [36, 0.75, "E6", 0.85],
  [36.75, 0.25, "C#6", 0.6],
  [37, 0.5, "B5", 0.65],
  [37.5, 0.5, "G#5", 0.6],
  [38, 1, "B5", 0.8],
  [39, 0.5, "F#5", 0.55],
  [39.5, 0.5, "G#5", 0.6],
];

const softer = (rows, by) =>
  rows.map(([beat, dur, pitch, vel]) => [beat, dur, pitch, vel - by]);

const first = [
  ...line("pluck", HOOK),
  ...chords("piano", [
    [16, 0.5, "E4 G#4 B4", 0.75],
    [18, 0.5, "C#4 E4 G#4 B4", 0.7],
    [20, 0.5, "C#4 E4 A4", 0.75],
    [22, 0.5, "D#4 F#4 B4", 0.7],
  ]),
  ...line("bell", [
    [16, 2, "G#6", 0.45],
    [18, 2, "E6", 0.4],
    [20, 2, "C#6", 0.45],
    [22, 2, "F#6", 0.4],
  ]),
  ...chords("pad", [
    [16, 2, "E3 B3 E4 G#4", 0.45],
    [18, 2, "C#3 G#3 B3 E4", 0.45],
    [20, 2, "A3 C#4 E4", 0.45],
    [22, 2, "B3 D#4 F#4", 0.45],
  ]),
  ...bounceHalf(16, "E2", "E3"),
  ...bounceHalf(18, "C#2", "C#3"),
  ...bounceHalf(20, "A1", "A2"),
  ...bounceHalf(22, "B1", "B2"),
];

const lifted = [
  ...line("pluck", HOOK_LIFTED),
  ...line("mallet", softer(HOOK_LIFTED, 0.1)),
  ...chords("piano", [
    [32, 0.5, "C#4 E4 G#4 B4", 0.75],
    [34, 0.5, "D#4 F#4 B4", 0.7],
    [36, 0.5, "C#4 E4 A4", 0.75],
    [38, 0.5, "D#4 F#4 B4", 0.7],
  ]),
  ...line("bell", [
    [32, 2, "B6", 0.45],
    [36, 2, "E6", 0.45],
  ]),
  ...chords("pad", [
    [32, 2, "C#3 G#3 B3 E4", 0.5],
    [34, 2, "B3 D#4 F#4", 0.5],
    [36, 2, "A3 C#4 E4 B4", 0.5],
    [38, 2, "B3 D#4 F#4", 0.5],
  ]),
  ...bounceHalf(32, "C#2", "C#3"),
  ...bounceHalf(34, "B1", "B2"),
  ...bounceHalf(36, "A1", "A2"),
  ...bounceHalf(38, "B1", "B2"),
];

export const hook = [
  ...groove(16, 40),
  ...clapFill(24),
  ...clapFill(32),
  ...clapFill(40),
  ...first,
  ...lifted,
];
