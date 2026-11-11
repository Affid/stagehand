// A look-ahead limiter for the rare peak that would pass the ceiling once
// the track is brought up to its loudness target. The gain is the smallest
// needed anywhere in the next few milliseconds, then averaged over the same
// span, so it bends smoothly and never lets a sample over.

import { SAMPLE_RATE } from "./buffers.mjs";

const WINDOW = Math.round(0.005 * SAMPLE_RATE);

function neededGains(buffer, ceiling) {
  const need = new Float64Array(buffer.left.length).fill(1);
  let touched = false;
  for (let i = 0; i < need.length; i += 1) {
    const peak = Math.max(Math.abs(buffer.left[i]), Math.abs(buffer.right[i]));
    if (peak > ceiling) {
      need[i] = ceiling / peak;
      touched = true;
    }
  }
  return touched ? need : null;
}

function lookAheadMinimum(need) {
  const out = new Float64Array(need.length).fill(1);
  for (let i = 0; i < need.length; i += 1) {
    if (need[i] === 1) continue;
    for (let j = Math.max(0, i - WINDOW); j <= i; j += 1) {
      if (need[i] < out[j]) out[j] = need[i];
    }
  }
  return out;
}

/** Returns { buffer, reducedSamples }; the input is left untouched. */
export function limit(buffer, ceiling) {
  const need = neededGains(buffer, ceiling);
  if (!need) return { buffer, reducedSamples: 0 };
  const minimum = lookAheadMinimum(need);
  const left = new Float64Array(need.length);
  const right = new Float64Array(need.length);
  let sum = 0;
  let reducedSamples = 0;
  for (let i = 0; i < need.length; i += 1) {
    sum += minimum[i] - (i >= WINDOW ? minimum[i - WINDOW] : 1);
    const gain = 1 + sum / WINDOW;
    if (gain < 0.9999) reducedSamples += 1;
    left[i] = buffer.left[i] * gain;
    right[i] = buffer.right[i] * gain;
  }
  return { buffer: { left, right }, reducedSamples };
}
