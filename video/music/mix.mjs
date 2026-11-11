// The balance, shared by every version. Each instrument's stem is brought to
// a fixed RMS level before mixing, whatever engine produced it, so the synth
// and the sampled renders are balanced the same way by measurement (nobody
// involved in making this could listen to it).

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
import { DURATION_SECONDS } from "./score.mjs";

/** level: whole-track stem RMS in dB (relative); send: share sent to the reverb. */
export const MIX = {
  piano: { level: -27, send: 0.3 },
  mallet: { level: -29.5, send: 0.28 },
  pad: { level: -30, send: 0.35 },
  bass: { level: -32, send: 0.05 },
  bell: { level: -43, send: 0.45 },
  kick: { level: -40, send: 0.05 },
  shaker: { level: -50, send: 0.2 },
};

const REVERB_SECONDS = 1.7;
const RUMBLE_HZ = 28;
const TOP_HZ = 10500;
const FADE_IN_SECONDS = 0.02;
// The reverb is faded out over the last second so the file ends in true
// silence; by then the tail is already far down.
const FADE_OUT_FROM = 39.9;
const FADE_OUT_SECONDS = 1.0;

export function mixStems(stems) {
  const dry = createStereo(DURATION_SECONDS);
  const send = createStereo(DURATION_SECONDS);
  for (const [inst, stem] of Object.entries(stems)) {
    const { level, send: share } = MIX[inst];
    const gain = dbToGain(level - rmsDb(stem));
    addStereo(dry, stem, gain);
    addStereo(send, stem, gain * share);
  }
  // Low notes in a reverb only make mud; keep them out of it.
  filterStereo(send, "highpass", 180, 0.707, SAMPLE_RATE);
  addStereo(dry, reverb(send, REVERB_SECONDS), 1);
  return dry;
}

/** Removes rumble and DC, softens the top, and fades the two ends. */
export function master(mix) {
  filterStereo(mix, "highpass", RUMBLE_HZ, 0.707, SAMPLE_RATE);
  filterStereo(mix, "lowpass", TOP_HZ, 0.707, SAMPLE_RATE);
  for (let i = 0; i < mix.left.length; i += 1) {
    const time = i / SAMPLE_RATE;
    const edge =
      riseAt(time + 1 / SAMPLE_RATE, FADE_IN_SECONDS) *
      fallAt(time, FADE_OUT_FROM, FADE_OUT_SECONDS);
    mix.left[i] *= edge;
    mix.right[i] *= edge;
  }
  return mix;
}
