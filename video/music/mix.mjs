// The mix and mastering, shared by every version of every cut. Each
// instrument's stem is brought to a fixed RMS level before mixing, whatever
// engine produced it, so the synth and the sampled renders are balanced the
// same way by measurement (nobody involved in making this could listen to it).
// The levels and the few per-cut settings live in cuts.mjs.

import { filterStereo } from "./dsp/biquad.mjs";
import {
  addStereo,
  createStereo,
  dbToGain,
  rmsDb,
  SAMPLE_RATE,
} from "./dsp/buffers.mjs";
import { reverb } from "./dsp/reverb.mjs";
import { fallAt, riseAt } from "./dsp/shapes.mjs";

const RUMBLE_HZ = 28;
const FADE_IN_SECONDS = 0.02;

export function mixStems(stems, cut) {
  const dry = createStereo(cut.seconds);
  const send = createStereo(cut.seconds);
  for (const [inst, stem] of Object.entries(stems)) {
    const { level, send: share } = cut.mix[inst];
    const gain = dbToGain(level - rmsDb(stem));
    addStereo(dry, stem, gain);
    addStereo(send, stem, gain * share);
  }
  // Low notes in a reverb only make mud; keep them out of it.
  filterStereo(send, "highpass", 180, 0.707, SAMPLE_RATE);
  addStereo(dry, reverb(send, cut.reverbSeconds), 1);
  return dry;
}

/** Removes rumble and DC, softens the top, and fades the two ends. */
export function master(mix, cut) {
  filterStereo(mix, "highpass", RUMBLE_HZ, 0.707, SAMPLE_RATE);
  filterStereo(mix, "lowpass", cut.topHz, 0.707, SAMPLE_RATE);
  for (let i = 0; i < mix.left.length; i += 1) {
    const time = i / SAMPLE_RATE;
    const edge =
      riseAt(time + 1 / SAMPLE_RATE, FADE_IN_SECONDS) *
      fallAt(time, cut.fadeOutFrom, cut.fadeOutSeconds);
    mix.left[i] *= edge;
    mix.right[i] *= edge;
  }
  return mix;
}
