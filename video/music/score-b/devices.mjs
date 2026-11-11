// Cut B, 12.0-16.0 s (beats 24-32): "on your computer and on your phone".
// The groove carries on (it is written in hook.mjs) under a new turn of the
// hook over A, E/G#, F#m7, B, with stabs and bells on the film's accents at
// 12, 13 and 14 s, and at 15 s a two-note call and answer, low then high,
// for the sync pulse between the two devices.

import { chords, line, steps } from "../score/build.mjs";
import { bounceHalf } from "./groove.mjs";

// Starts where the hook peaked and comes down, then climbs back to the call.
const HOOK_TURNED = [
  [24, 0.5, "E6", 0.82],
  [24.5, 0.5, "C#6", 0.65],
  [25.25, 0.25, "B5", 0.6],
  [25.5, 0.5, "C#6", 0.65],
  [26, 1, "G#5", 0.8],
  [27, 0.5, "B5", 0.6],
  [27.5, 0.5, "C#6", 0.65],
  [28, 0.75, "A5", 0.85],
  [28.75, 0.25, "B5", 0.6],
  [29, 0.5, "C#6", 0.65],
  [29.5, 0.5, "E6", 0.7],
];

// Low on pluck and mallet, then the same note an octave up with a bell.
const syncPulse = [
  ...line("pluck", [
    [30, 0.5, "B4", 0.85],
    [30.5, 0.5, "B5", 0.8],
  ]),
  ...line("mallet", [
    [30, 0.5, "B4", 0.8],
    [30.5, 0.5, "B5", 0.75],
  ]),
  ...line("bell", [[30.5, 2, "B6", 0.45]]),
];

export const devices = [
  ...line("pluck", HOOK_TURNED),
  ...syncPulse,
  ...steps("pluck", 31, 0.25, "F#5 G#5 B5 D#6", { vel: 0.55, velEnd: 0.75 }),
  ...chords("piano", [
    [24, 0.5, "C#4 E4 A4", 0.75],
    [26, 0.5, "B3 E4 G#4", 0.72],
    [28, 0.5, "C#4 E4 F#4 A4", 0.75],
    [30, 0.5, "D#4 F#4 B4", 0.7],
  ]),
  ...line("bell", [
    [24, 2, "E6", 0.45],
    [26, 2, "G#6", 0.42],
    [28, 2, "A6", 0.45],
  ]),
  ...chords("pad", [
    [24, 2, "A3 C#4 E4", 0.5],
    [26, 2, "G#3 B3 E4", 0.5],
    [28, 2, "F#3 A3 C#4 E4", 0.5],
    [30, 2, "B3 D#4 F#4", 0.5],
  ]),
  ...bounceHalf(24, "A1", "A2"),
  ...bounceHalf(26, "G#2", "G#3"),
  ...bounceHalf(28, "F#2", "F#3"),
  ...bounceHalf(30, "B1", "B2"),
];
