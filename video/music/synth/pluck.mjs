// Cut B's plucked voices: a Karplus-Strong string for the hook and a
// bouncy bass whose upper harmonics close quickly, like a filter snapping shut.

import { SAMPLE_RATE } from "../dsp/buffers.mjs";
import { createNoise, fallAt, onePole, riseAt } from "../dsp/shapes.mjs";
import { hzOf } from "../score/pitch.mjs";

const STRING_RING_SECONDS = 1.6;
const MUTE_PER_PERIOD = 0.9;
const STRING_TAIL_SECONDS = 0.12;

/** One period of low-passed noise, scaled to full height: the pluck itself. */
function excitation(length, note) {
  const noise = createNoise(note.midi * 2749 + Math.round(note.start * 1000));
  // Smoothed twice: a single pass leaves enough hiss for the pluck to spit.
  const smoothing = onePole(900 + 2600 * note.vel, SAMPLE_RATE);
  const burst = new Float64Array(length);
  let low = 0;
  let lower = 0;
  for (let i = 0; i < length; i += 1) {
    low += smoothing * (noise() - low);
    lower += smoothing * (low - lower);
    burst[i] = lower;
  }
  const mean = burst.reduce((sum, value) => sum + value, 0) / length;
  const peak = burst.reduce(
    (max, value) => Math.max(max, Math.abs(value - mean)),
    1e-9,
  );
  return burst.map((value) => (value - mean) / peak);
}

/**
 * Karplus-Strong: a burst of noise circulates in a delay one period long and
 * is averaged a little on every trip, so it settles into a decaying string
 * tone. An all-pass stage supplies the fraction of a sample the delay lacks,
 * which keeps high notes in tune.
 */
export function pluck(note) {
  const period = SAMPLE_RATE / hzOf(note.midi);
  const whole = Math.floor(period - 0.6);
  const fraction = period - 0.5 - whole;
  const tuning = (1 - fraction) / (1 + fraction);
  const ring = 10 ** (-3 / (hzOf(note.midi) * STRING_RING_SECONDS));
  const line = excitation(whole, note);
  const total = note.seconds + STRING_TAIL_SECONDS;
  const out = new Float64Array(Math.round(total * SAMPLE_RATE));
  let previous = 0;
  let passIn = 0;
  let passOut = 0;
  for (let i = 0; i < out.length; i += 1) {
    const time = i / SAMPLE_RATE;
    const index = i % whole;
    const current = line[index];
    const averaged = 0.5 * (current + previous);
    previous = current;
    passOut = tuning * averaged + passIn - tuning * passOut;
    passIn = averaged;
    // After the written length the string is damped, as by a finger.
    const loss = time < note.seconds ? ring : ring * MUTE_PER_PERIOD;
    line[index] = passOut * loss;
    out[i] =
      note.vel *
      current *
      riseAt(time, 0.001) *
      fallAt(time, total - 0.02, 0.02);
  }
  return [
    {
      samples: out,
      pan: Math.max(-0.35, Math.min(0.35, (note.midi - 76) / 40)),
    },
  ];
}

const BOUNCE_TOP_HZ = 1500;
const BOUNCE_RELEASE_SECONDS = 0.05;

/** Sawtooth harmonics; each higher one falls faster and settles lower. */
export function bounce(note) {
  const hz = hzOf(note.midi);
  const total = note.seconds + BOUNCE_RELEASE_SECONDS;
  const out = new Float64Array(Math.round(total * SAMPLE_RATE));
  for (let n = 1; n * hz < BOUNCE_TOP_HZ; n += 1) {
    const step = (2 * Math.PI * hz * n) / SAMPLE_RATE;
    const settle = 1 / (1 + 0.9 * (n - 1));
    const fall = 0.1 / (1 + 0.3 * (n - 1));
    for (let i = 0; i < out.length; i += 1) {
      const envelope =
        settle + (1 - settle) * Math.exp(-i / SAMPLE_RATE / fall);
      out[i] += (envelope / n) * Math.sin(step * i);
    }
  }
  for (let i = 0; i < out.length; i += 1) {
    const time = i / SAMPLE_RATE;
    out[i] *=
      note.vel *
      riseAt(time, 0.005) *
      fallAt(time, note.seconds, BOUNCE_RELEASE_SECONDS);
  }
  return [{ samples: out, pan: 0 }];
}
