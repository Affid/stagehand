// The whole piece as data: tempo, key, the film's sections and every note.
// Both renderers (synth and sampled) read this module and nothing else, so a
// change here is heard in every version after one re-render.

import { closing } from "./score/closing.mjs";
import { library } from "./score/library.mjs";
import { opening } from "./score/opening.mjs";
import { midiOf } from "./score/pitch.mjs";

export const BPM = 120;
export const SECONDS_PER_BEAT = 60 / BPM;
export const DURATION_SECONDS = 41;
export const KEY = "D major";

/** The film's sections, in seconds, for the printout and the README. */
export const SECTIONS = [
  { start: 0, name: "Opening: the cluttered page, still" },
  { start: 2, name: "Scene change: lift-off, sorting run, landing at 7.0" },
  { start: 8, name: "Library: groove and theme (accents 8.0, 10.5, 13.0)" },
  { start: 16, name: "By world: theme lifted" },
  { start: 22, name: "Queue a change: thin (toggle at 24.5)" },
  { start: 28, name: "Review before launch: suspended (swell to 29.5)" },
  { start: 34, name: "End card: resolution at 34.5, theme at half speed" },
];

/** The instruments the sparse "simple" version keeps. */
export const SIMPLE_INSTRUMENTS = ["piano", "pad", "bass"];

function timed(note) {
  return {
    ...note,
    midi: midiOf(note.pitch),
    start: note.beat * SECONDS_PER_BEAT,
    seconds: note.dur * SECONDS_PER_BEAT,
  };
}

export const NOTES = [...opening, ...library, ...closing]
  .map(timed)
  .sort((a, b) => a.start - b.start || a.midi - b.midi);

export function notesFor(instruments) {
  return NOTES.filter((note) => instruments.includes(note.inst));
}
