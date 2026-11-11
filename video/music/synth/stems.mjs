// Renders one stereo stem per instrument from a score with the synth engine.

import { createStereo, mixMono } from "../dsp/buffers.mjs";
import { clap, click, hat, punch, riser } from "./beat.mjs";
import { bell, mallet } from "./mallet.mjs";
import { pad } from "./pad.mjs";
import { piano } from "./piano.mjs";
import { bounce, pluck } from "./pluck.mjs";
import { bass, kick, shaker } from "./rhythm.mjs";

const VOICES = {
  piano,
  mallet,
  bell,
  pad,
  bass,
  kick,
  shaker,
  pluck,
  bounce,
  punch,
  clap,
  hat,
  click,
  riser,
};

export function synthStems(notes, seconds) {
  const stems = {};
  for (const note of notes) {
    stems[note.inst] ??= createStereo(seconds);
    for (const layer of VOICES[note.inst](note)) {
      mixMono(stems[note.inst], layer.samples, note.start, 1, layer.pan);
    }
  }
  return stems;
}
