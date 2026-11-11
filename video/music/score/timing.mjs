// Turns written notes (beats, pitch names) into timed ones (seconds, MIDI).

import { midiOf } from "./pitch.mjs";

export function timeNotes(notes, secondsPerBeat) {
  return notes
    .map((note) => ({
      ...note,
      midi: midiOf(note.pitch),
      start: note.beat * secondsPerBeat,
      seconds: note.dur * secondsPerBeat,
    }))
    .sort((a, b) => a.start - b.start || a.midi - b.midi);
}
