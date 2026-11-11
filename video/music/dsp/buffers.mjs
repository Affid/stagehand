// Stereo float buffers and the few operations every stage shares. Audio
// buffers are filled in place: copying two million samples per note would
// only slow the render, and no buffer is shared between stages.

export const SAMPLE_RATE = 48000;

export function createStereo(seconds) {
  const length = Math.round(seconds * SAMPLE_RATE);
  return { left: new Float64Array(length), right: new Float64Array(length) };
}

/** Adds a mono signal at a start time with an equal-power pan (-1..1). */
export function mixMono(target, samples, startSeconds, gain, pan) {
  const angle = ((pan + 1) * Math.PI) / 4;
  const gainLeft = gain * Math.cos(angle) * Math.SQRT2;
  const gainRight = gain * Math.sin(angle) * Math.SQRT2;
  const offset = Math.round(startSeconds * SAMPLE_RATE);
  const count = Math.min(samples.length, target.left.length - offset);
  for (let i = 0; i < count; i += 1) {
    target.left[offset + i] += samples[i] * gainLeft;
    target.right[offset + i] += samples[i] * gainRight;
  }
}

export function addStereo(target, source, gain) {
  for (let i = 0; i < target.left.length; i += 1) {
    target.left[i] += source.left[i] * gain;
    target.right[i] += source.right[i] * gain;
  }
}

export function scaleStereo(buffer, gain) {
  for (let i = 0; i < buffer.left.length; i += 1) {
    buffer.left[i] *= gain;
    buffer.right[i] *= gain;
  }
}

export function rmsDb(buffer, from = 0, to = buffer.left.length) {
  let sum = 0;
  for (let i = from; i < to; i += 1) {
    sum += buffer.left[i] ** 2 + buffer.right[i] ** 2;
  }
  return 10 * Math.log10(sum / (2 * Math.max(1, to - from)) + 1e-20);
}

export function peakDb(buffer) {
  let peak = 0;
  for (let i = 0; i < buffer.left.length; i += 1) {
    peak = Math.max(peak, Math.abs(buffer.left[i]), Math.abs(buffer.right[i]));
  }
  return 20 * Math.log10(peak + 1e-20);
}

export function dbToGain(db) {
  return 10 ** (db / 20);
}
