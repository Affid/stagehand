// Renders one stereo stem per instrument from the score with the synth engine.

import { createStereo, mixMono } from "../dsp/buffers.mjs";
import { DURATION_SECONDS } from "../score.mjs";
import { bell, mallet } from "./mallet.mjs";
import { pad } from "./pad.mjs";
import { piano } from "./piano.mjs";
import { bass, kick, shaker } from "./rhythm.mjs";

const VOICES = { piano, mallet, bell, pad, bass, kick, shaker };

export function synthStems(notes) {
  const stems = {};
  for (const note of notes) {
    stems[note.inst] ??= createStereo(DURATION_SECONDS);
    for (const layer of VOICES[note.inst](note)) {
      mixMono(stems[note.inst], layer.samples, note.start, 1, layer.pan);
    }
  }
  return stems;
}
