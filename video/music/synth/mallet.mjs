// Marimba-like mallet and a small bell, both by modal synthesis: a struck bar
// rings at a few fixed, inharmonic partials, each a sine that dies away on its
// own clock, the upper ones much sooner than the fundamental.

import { SAMPLE_RATE } from "../dsp/buffers.mjs";
import { createNoise, fallAt, onePole, riseAt } from "../dsp/shapes.mjs";
import { hzOf } from "../score/pitch.mjs";

const TOP_PARTIAL_HZ = 9000;
const ATTACK_SECONDS = 0.002;
const EDGE_SECONDS = 0.02;

// A marimba bar is tuned so its second mode sits two octaves up (ratio ~4)
// and its third near 10; the upper modes are short and give the "tock".
const MARIMBA = {
  ratios: [1, 3.93, 9.7],
  amps: [1, 0.22, 0.05],
  decays: [1, 0.25, 0.08],
};
// Glockenspiel-like bar ratios, kept soft: little of the upper modes.
const BELL = {
  ratios: [1, 2.76, 5.4],
  amps: [1, 0.28, 0.07],
  decays: [1, 0.45, 0.2],
};

function ringSeconds(hz, model) {
  if (model === BELL) return Math.min(1.1, 0.9 * (1200 / hz) ** 0.5);
  return Math.min(0.9, Math.max(0.14, 0.42 * (262 / hz) ** 0.6));
}

function strike(note, model, clickLevel) {
  const hz = hzOf(note.midi);
  const ring = ringSeconds(hz, model);
  const length = Math.round(ring * 6 * SAMPLE_RATE);
  const out = new Float64Array(length);
  const total = length / SAMPLE_RATE;
  model.ratios.forEach((ratio, n) => {
    const partialHz = hz * ratio;
    if (partialHz > TOP_PARTIAL_HZ) return;
    // A harder hit excites the upper modes more, like a real mallet.
    const amp = model.amps[n] * (n === 0 ? 1 : 0.5 + note.vel);
    const step = (2 * Math.PI * partialHz) / SAMPLE_RATE;
    const decay = ring * model.decays[n];
    for (let i = 0; i < length; i += 1) {
      out[i] += amp * Math.exp(-i / SAMPLE_RATE / decay) * Math.sin(step * i);
    }
  });
  addMalletClick(out, note, clickLevel);
  for (let i = 0; i < length; i += 1) {
    const time = i / SAMPLE_RATE;
    out[i] *=
      note.vel *
      riseAt(time, ATTACK_SECONDS) *
      fallAt(time, total - EDGE_SECONDS, EDGE_SECONDS);
  }
  return out;
}

/** A few milliseconds of low-passed noise: the mallet touching the bar. */
function addMalletClick(out, note, level) {
  const noise = createNoise(note.midi * 7919 + Math.round(note.start * 1000));
  const smoothing = onePole(2500, SAMPLE_RATE);
  const count = Math.min(out.length, Math.round(0.012 * SAMPLE_RATE));
  let low = 0;
  for (let i = 0; i < count; i += 1) {
    low += smoothing * (noise() - low);
    out[i] += level * low * Math.exp(-i / (0.003 * SAMPLE_RATE));
  }
}

// Low notes sit a little left, high ones a little right, as on the instrument.
function panFor(note) {
  return Math.max(-0.5, Math.min(0.5, (note.midi - 72) / 40));
}

export function mallet(note) {
  return [{ samples: strike(note, MARIMBA, 0.25), pan: panFor(note) }];
}

export function bell(note) {
  return [{ samples: strike(note, BELL, 0.05), pan: 0.25 }];
}
