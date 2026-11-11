// Envelope shapes and a seeded noise source. Every note starts and ends on a
// raised-cosine ramp, which is what keeps note edges from clicking.

/** 0 to 1 over `length` seconds, smooth at both ends. */
export function riseAt(time, length) {
  if (time <= 0) return 0;
  if (time >= length) return 1;
  return 0.5 - 0.5 * Math.cos((Math.PI * time) / length);
}

/** 1 to 0 over `length` seconds starting at `from`. */
export function fallAt(time, from, length) {
  return 1 - riseAt(time - from, length);
}

/** A seeded generator (mulberry32) so two renders are sample-identical. */
export function createNoise(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 2147483648 - 1;
  };
}

/** One-pole low-pass coefficient for a cutoff in hertz. */
export function onePole(cutoffHz, sampleRate) {
  return 1 - Math.exp((-2 * Math.PI * cutoffHz) / sampleRate);
}
