// Cut B's whole piece as data: the upbeat, beat-cut alternative to score.mjs.
// Both renderers read this module, so a change here is heard in both
// versions after one re-render.

import { closing } from "./score-b/closing.mjs";
import { hook } from "./score-b/hook.mjs";
import { opening } from "./score-b/opening.mjs";
import { timeNotes } from "./score/timing.mjs";

export const BPM = 120;
export const SECONDS_PER_BEAT = 60 / BPM;
export const DURATION_SECONDS = 30;
export const KEY = "E major";
/** Pitch classes of E major (C = 0), for the proof-reading printout. */
export const KEY_PITCH_CLASSES = [4, 6, 8, 9, 11, 1, 3];

export const SECTIONS = [
  { start: 0, name: "Intro: slams at 0.0 and 1.0" },
  { start: 2, name: "Name reveal: held chord, riser into 4.0" },
  { start: 4, name: "Drop: groove; folder piles land 4.5-7.5; fill" },
  { start: 8, name: "Library: hook (accents 9.0, 10.0, 11.0)" },
  { start: 12, name: "By world: hook lifted, mallet added" },
  { start: 16, name: "Queue a change: thinner (click 17.0, accent 18.5)" },
  {
    start: 20,
    name: "Review: build (accents 20.5, 21.5, 22.5), riser 23-24, drums out",
  },
  { start: 24, name: "Recap: hits every 0.25 s, fill" },
  { start: 26, name: "Final hit: tonic, hook echo at 27.0, tail" },
];

/** Every moment the picture cuts or lands on; each must have a note onset. */
export const HIT_TIMES = [
  0, 1, 2, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.25, 7.5, 8, 9, 10, 11, 12, 16, 17, 18.5,
  20, 20.5, 21.5, 22.5, 24, 24.25, 24.5, 24.75, 25, 25.25, 26, 27,
];

export const NOTES = timeNotes(
  [...opening, ...hook, ...closing],
  SECONDS_PER_BEAT,
);
