// node print-score.mjs [a|b]: prints a cut's score as text, one line per
// onset, so the notes can be proof-read for wrong octaves and out-of-key
// pitches without hearing them. For a cut with listed hit times it also
// shows what sounds on each one.

import { parseCutArgs } from "./cuts.mjs";

const UNPITCHED = new Set([
  "shaker",
  "kick",
  "punch",
  "clap",
  "hat",
  "click",
  "riser",
]);
const { cut } = parseCutArgs(process.argv.slice(2, 3));
const { KEY, KEY_PITCH_CLASSES, NOTES, SECTIONS, HIT_TIMES } = cut.score;
const inKey = new Set(KEY_PITCH_CLASSES);

function sectionAt(seconds) {
  return SECTIONS.filter((section) => section.start <= seconds).at(-1);
}

function describe(note) {
  if (UNPITCHED.has(note.inst)) return `${note.inst}:`;
  return `${note.inst}:${note.pitch}${inKey.has(note.midi % 12) ? "" : "(!)"}`;
}

function printOnsets() {
  const byOnset = Map.groupBy(NOTES, (note) => note.start.toFixed(3));
  let current = null;
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
}

function printRanges() {
  const pitched = Map.groupBy(
    NOTES.filter((note) => !UNPITCHED.has(note.inst)),
    (note) => note.inst,
  );
  console.log("\nRanges (MIDI):");
  for (const [inst, notes] of pitched) {
    const midis = notes.map((note) => note.midi);
    const last = Math.max(...notes.map((note) => note.start + note.seconds));
    console.log(
      `  ${inst}: ${Math.min(...midis)}-${Math.max(...midis)}, ${notes.length} notes, last note-off ${last.toFixed(2)} s`,
    );
  }
  console.log(
    `  last onset of any note: ${Math.max(...NOTES.map((note) => note.start)).toFixed(2)} s`,
  );
}

function printHits() {
  if (HIT_TIMES.length === 0) return;
  console.log("\nOnsets on the film's hit times:");
  for (const time of HIT_TIMES) {
    const sounding = NOTES.filter(
      (note) => Math.abs(note.start - time) < 1e-6 && note.inst !== "hat",
    );
    const names = [...new Set(sounding.map((note) => note.inst))].join(", ");
    console.log(`  ${time.toFixed(2).padStart(5)} s  ${names || "MISSING"}`);
  }
}

console.log(
  `Cut ${cut.id.toUpperCase()}: key ${KEY}; ${NOTES.length} notes. (!) marks a pitch outside the key.`,
);
printOnsets();
printRanges();
printHits();
