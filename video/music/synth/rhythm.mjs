// The quiet rhythm section: a round bass, a soft kick and a shaker.

import { filterInPlace } from "../dsp/biquad.mjs";
import { SAMPLE_RATE } from "../dsp/buffers.mjs";
import { createNoise, fallAt, onePole, riseAt } from "../dsp/shapes.mjs";
import { hzOf } from "../score/pitch.mjs";

const BASS_HARMONICS = [1, 0.35, 0.12];
const BASS_RELEASE_SECONDS = 0.18;

/** A sine with a little second and third harmonic so small speakers hear it. */
export function bass(note) {
  const hz = hzOf(note.midi);
  const total = note.seconds + BASS_RELEASE_SECONDS;
  const out = new Float64Array(Math.round(total * SAMPLE_RATE));
  for (let i = 0; i < out.length; i += 1) {
    const time = i / SAMPLE_RATE;
    const phase = 2 * Math.PI * hz * time;
    const tone = BASS_HARMONICS.reduce(
      (sum, amp, n) => sum + amp * Math.sin(phase * (n + 1)),
      0,
    );
    const body = 0.6 + 0.4 * Math.exp(-time / 0.4);
    out[i] =
      note.vel *
      tone *
      body *
      riseAt(time, 0.015) *
      fallAt(time, note.seconds, BASS_RELEASE_SECONDS);
  }
  return [{ samples: out, pan: 0 }];
}

/** A sine that drops from about 95 to 48 Hz: felt more than heard. */
export function kick(note) {
  const total = 0.5;
  const out = new Float64Array(Math.round(total * SAMPLE_RATE));
  let phase = 0;
  for (let i = 0; i < out.length; i += 1) {
    const time = i / SAMPLE_RATE;
    phase += (2 * Math.PI * (48 + 47 * Math.exp(-time / 0.04))) / SAMPLE_RATE;
    const envelope =
      Math.exp(-time / 0.11) *
      riseAt(time, 0.003) *
      fallAt(time, total - 0.05, 0.05);
    out[i] = note.vel * envelope * Math.sin(phase);
  }
  return [{ samples: out, pan: 0 }];
}

/** A short burst of band-passed noise, low-passed again to stay gentle. */
export function shaker(note) {
  const total = 0.16;
  const noise = createNoise(Math.round(note.start * 1000) + 17);
  const out = Float64Array.from(
    { length: Math.round(total * SAMPLE_RATE) },
    noise,
  );
  filterInPlace(out, "bandpass", 5200, 1.1, SAMPLE_RATE);
  const smoothing = onePole(7500, SAMPLE_RATE);
  let low = 0;
  for (let i = 0; i < out.length; i += 1) {
    const time = i / SAMPLE_RATE;
    low += smoothing * (out[i] - low);
    out[i] =
      note.vel *
      low *
      riseAt(time, 0.006) *
      Math.exp(-time / 0.028) *
      fallAt(time, total - 0.03, 0.03);
  }
  return [{ samples: out, pan: -0.3 }];
}
