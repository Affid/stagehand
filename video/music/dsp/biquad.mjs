// Second-order filters (the "Audio EQ Cookbook" forms), run in place.

function coefficients(type, cutoffHz, q, sampleRate) {
  const omega = (2 * Math.PI * cutoffHz) / sampleRate;
  const alpha = Math.sin(omega) / (2 * q);
  const cos = Math.cos(omega);
  const a0 = 1 + alpha;
  const shapes = {
    lowpass: [(1 - cos) / 2, 1 - cos, (1 - cos) / 2],
    highpass: [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2],
    bandpass: [alpha, 0, -alpha],
  };
  const [b0, b1, b2] = shapes[type];
  return {
    b0: b0 / a0,
    b1: b1 / a0,
    b2: b2 / a0,
    a1: (-2 * cos) / a0,
    a2: (1 - alpha) / a0,
  };
}

export function filterInPlace(samples, type, cutoffHz, q, sampleRate) {
  const { b0, b1, b2, a1, a2 } = coefficients(type, cutoffHz, q, sampleRate);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const x = samples[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    samples[i] = y;
  }
  return samples;
}

export function filterStereo(buffer, type, cutoffHz, q, sampleRate) {
  filterInPlace(buffer.left, type, cutoffHz, q, sampleRate);
  filterInPlace(buffer.right, type, cutoffHz, q, sampleRate);
  return buffer;
}
