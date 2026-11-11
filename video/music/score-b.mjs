// Cut B's whole piece as data: the upbeat, beat-cut alternative to score.mjs.
// Both renderers read this module, so a change here is heard in both
// versions after one re-render.

import { closing } from "./score-b/closing.mjs";
import { devices } from "./score-b/devices.mjs";
import { whoosh } from "./score-b/groove.mjs";
import { hook } from "./score-b/hook.mjs";
import { opening } from "./score-b/opening.mjs";
import { timeNotes } from "./score/timing.mjs";

export const BPM = 120;
export const SECONDS_PER_BEAT = 60 / BPM;
export const DURATION_SECONDS = 34;
export const KEY = "E major";
/** Pitch classes of E major (C = 0), for the proof-reading printout. */
export const KEY_PITCH_CLASSES = [4, 6, 8, 9, 11, 1, 3];

export const SECTIONS = [
  { start: 0, name: "Intro: slams at 0.0 and 1.0" },
  { start: 2, name: "Name reveal: held chord, riser into 4.0" },
  { start: 4, name: "Drop: groove; folder piles land 4.5-7.5; fill" },
  { start: 8, name: "Library: hook (accents 9.0, 10.0, 11.0)" },
  {
    start: 12,
    name: "Devices: hook turned (accents 12, 13, 14; call and answer 15)",
  },
  { start: 16, name: "By world: hook lifted, mallet added" },
  { start: 20, name: "Queue a change: thinner (click 21.0, accent 22.5)" },
  {
    start: 24,
    name: "Review: build (accents 24.5, 25.5, 26.5), riser 27-28, drums out",
  },
  { start: 28, name: "Recap: hits every 0.25 s, fill" },
  { start: 30, name: "Final hit: tonic, hook echo at 31.0, tail" },
];

/** Every moment the picture cuts or lands on; each must have a note onset. */
export const HIT_TIMES = [
  0, 1, 2, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.25, 7.5, 8, 9, 10, 11, 12, 13, 14, 15,
  15.25, 16, 20, 21, 22.5, 24, 24.5, 25.5, 26.5, 28, 28.25, 28.5, 28.75, 29,
  29.25, 30, 31,
];

/** Scene changes in the picture, in beats; a whoosh ends on each one. */
const SCENE_CHANGE_BEATS = [16, 24, 32, 40, 48];

export const NOTES = timeNotes(
  [
    ...opening,
    ...hook,
    ...devices,
    ...closing,
    ...SCENE_CHANGE_BEATS.flatMap(whoosh),
  ],
  SECONDS_PER_BEAT,
);
