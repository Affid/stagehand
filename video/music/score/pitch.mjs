// Pitch names ("F#5") to MIDI numbers and frequencies. Middle C is C4 = 60.

const SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const A4_MIDI = 69;
const A4_HZ = 440;

export function midiOf(name) {
  const match = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!match) throw new Error(`Not a pitch name: ${name}`);
  const [, letter, accidental, octave] = match;
  const shift = accidental === "#" ? 1 : accidental === "b" ? -1 : 0;
  return 12 * (Number(octave) + 1) + SEMITONES[letter] + shift;
}

export function hzOf(midi) {
  return A4_HZ * 2 ** ((midi - A4_MIDI) / 12);
}
