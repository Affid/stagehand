// Prints the score as text, one line per onset, so the notes can be proof-read
// for wrong octaves and out-of-key pitches without hearing them.

import { KEY, NOTES, SECTIONS } from "./score.mjs";

const D_MAJOR = new Set([2, 4, 6, 7, 9, 11, 1]);
const UNPITCHED = new Set(["shaker", "kick"]);

function sectionAt(seconds) {
  return SECTIONS.filter((section) => section.start <= seconds).at(-1);
}

function describe(note) {
  const inKey = UNPITCHED.has(note.inst) || D_MAJOR.has(note.midi % 12);
  const pitch = UNPITCHED.has(note.inst) ? "" : note.pitch;
  return `${note.inst}:${pitch}${inKey ? "" : "(!)"}`;
}

const byOnset = Map.groupBy(NOTES, (note) => note.start.toFixed(3));
let current = null;
console.log(
  `Key ${KEY}; ${NOTES.length} notes. (!) marks a pitch outside the key.`,
);
for (const [start, notes] of byOnset) {
  const section = sectionAt(Number(start));
  if (section !== current) {
    current = section;
    console.log(`\n== ${section.start.toFixed(1)} s  ${section.name}`);
  }
  const beat = notes[0].beat.toFixed(2).padStart(6);
  console.log(
    `${start.padStart(7)} s  beat ${beat}  ${notes.map(describe).join("  ")}`,
  );
}

const ranges = Map.groupBy(
  NOTES.filter((note) => !UNPITCHED.has(note.inst)),
  (note) => note.inst,
);
console.log("\nRanges (MIDI):");
for (const [inst, notes] of ranges) {
  const midis = notes.map((note) => note.midi);
  const last = Math.max(...notes.map((note) => note.start + note.seconds));
  console.log(
    `  ${inst}: ${Math.min(...midis)}-${Math.max(...midis)}, ${notes.length} notes, last note-off ${last.toFixed(2)} s`,
  );
}
