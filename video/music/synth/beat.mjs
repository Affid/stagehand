// Cut B's drums and effects, all from sines and filtered noise: a punchy but
// soft-edged kick, a clap, a short hi-hat, a switch-like click and a riser.

import { filterInPlace } from "../dsp/biquad.mjs";
import { SAMPLE_RATE } from "../dsp/buffers.mjs";
import { createNoise, fallAt, onePole, riseAt } from "../dsp/shapes.mjs";

function noiseBuffer(seconds, seed) {
  return Float64Array.from(
    { length: Math.round(seconds * SAMPLE_RATE) },
    createNoise(seed),
  );
}

function seedOf(note, salt) {
  return Math.round(note.start * 1000) * 31 + salt;
}

/** A sine falling from 160 to 50 Hz in a few hundredths of a second. */
export function punch(note) {
  const total = 0.45;
  const out = new Float64Array(Math.round(total * SAMPLE_RATE));
  let phase = 0;
  for (let i = 0; i < out.length; i += 1) {
    const time = i / SAMPLE_RATE;
    phase += (2 * Math.PI * (50 + 110 * Math.exp(-time / 0.035))) / SAMPLE_RATE;
    const envelope =
      Math.exp(-time / 0.13) *
      riseAt(time, 0.002) *
      fallAt(time, total - 0.05, 0.05);
    out[i] = note.vel * envelope * Math.sin(phase);
  }
  return [{ samples: out, pan: 0 }];
}

// Several hands never land together: three quick bursts, then the body.
const CLAP_BURSTS = [
  { at: 0, fall: 0.004, level: 0.7 },
  { at: 0.011, fall: 0.004, level: 0.8 },
  { at: 0.022, fall: 0.004, level: 0.9 },
  { at: 0.031, fall: 0.045, level: 1 },
];

export function clap(note) {
  const total = 0.3;
  const out = filterInPlace(
    noiseBuffer(total, seedOf(note, 3)),
    "bandpass",
    1500,
    1.3,
    SAMPLE_RATE,
  );
  filterInPlace(out, "lowpass", 6000, 0.707, SAMPLE_RATE);
  for (let i = 0; i < out.length; i += 1) {
    const time = i / SAMPLE_RATE;
    const envelope = CLAP_BURSTS.reduce(
      (sum, burst) =>
        time < burst.at
          ? sum
          : Math.max(
              sum,
              burst.level * Math.exp(-(time - burst.at) / burst.fall),
            ),
      0,
    );
    out[i] *=
      note.vel *
      envelope *
      riseAt(time, 0.001) *
      fallAt(time, total - 0.04, 0.04);
  }
  return [{ samples: out, pan: 0.15 }];
}

export function hat(note) {
  const total = 0.09;
  const out = filterInPlace(
    noiseBuffer(total, seedOf(note, 5)),
    "highpass",
    6500,
    0.707,
    SAMPLE_RATE,
  );
  for (let i = 0; i < out.length; i += 1) {
    const time = i / SAMPLE_RATE;
    out[i] *=
      note.vel *
      Math.exp(-time / 0.018) *
      riseAt(time, 0.001) *
      fallAt(time, total - 0.02, 0.02);
  }
  return [{ samples: out, pan: -0.25 }];
}

/** Two short inharmonic pings and a speck of noise: a switch being flipped. */
export function click(note) {
  const total = 0.08;
  const noise = createNoise(seedOf(note, 7));
  const out = new Float64Array(Math.round(total * SAMPLE_RATE));
  for (let i = 0; i < out.length; i += 1) {
    const time = i / SAMPLE_RATE;
    const ping = Math.sin(2 * Math.PI * 1900 * time) * Math.exp(-time / 0.006);
    const body =
      0.6 * Math.sin(2 * Math.PI * 520 * time) * Math.exp(-time / 0.012);
    const speck = 0.3 * noise() * Math.exp(-time / 0.0015);
    out[i] =
      note.vel *
      (ping + body + speck) *
      riseAt(time, 0.0005) *
      fallAt(time, total - 0.02, 0.02);
  }
  return [{ samples: out, pan: 0.1 }];
}

const RISER_FROM_HZ = 300;
const RISER_TO_HZ = 5000;
const RISER_DAMPING = 0.5;

/** Noise through a band-pass (a state-variable filter) whose centre climbs. */
function riserChannel(note, seed) {
  const noise = createNoise(seed);
  const out = new Float64Array(Math.round(note.seconds * SAMPLE_RATE));
  let low = 0;
  let band = 0;
  for (let i = 0; i < out.length; i += 1) {
    const progress = i / out.length;
    const centre = RISER_FROM_HZ * (RISER_TO_HZ / RISER_FROM_HZ) ** progress;
    const f = 2 * Math.sin((Math.PI * centre) / SAMPLE_RATE);
    low += f * band;
    band += f * (noise() - low - RISER_DAMPING * band);
    // Quiet for most of its length, then up quickly; cut just before the hit.
    out[i] =
      note.vel *
      band *
      progress ** 2 *
      fallAt(i / SAMPLE_RATE, note.seconds - 0.04, 0.04);
  }
  return out;
}

export function riser(note) {
  return [
    { samples: riserChannel(note, seedOf(note, 11)), pan: -0.6 },
    { samples: riserChannel(note, seedOf(note, 13)), pan: 0.6 },
  ];
}
