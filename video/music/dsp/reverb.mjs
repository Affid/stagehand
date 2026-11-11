// A small feedback delay network reverb: two all-pass diffusers per channel
// smear the plucks, then eight delay lines feed each other through a
// Householder matrix. Each line is low-passed inside the loop, so the tail
// darkens as it decays the way a soft room does.

import { createStereo, SAMPLE_RATE } from "./buffers.mjs";
import { onePole } from "./shapes.mjs";

const LINE_SAMPLES = [1423, 1637, 1873, 2087, 2311, 2539, 2753, 2999];
const DIFFUSER_SAMPLES = [
  [241, 383],
  [269, 421],
];
const DIFFUSER_GAIN = 0.6;
const PREDELAY_SECONDS = 0.018;
const DAMPING_HZ = 4200;

function createAllpass(length) {
  const memory = new Float64Array(length);
  let index = 0;
  return (input) => {
    const delayed = memory[index];
    const value = input + delayed * DIFFUSER_GAIN;
    memory[index] = value;
    index = (index + 1) % length;
    return delayed - value * DIFFUSER_GAIN;
  };
}

function createLines(decaySeconds) {
  return LINE_SAMPLES.map((length) => ({
    memory: new Float64Array(length),
    index: 0,
    // The gain that makes this line lose 60 dB in decaySeconds.
    feedback: 10 ** ((-3 * length) / (decaySeconds * SAMPLE_RATE)),
    damped: 0,
  }));
}

function stepLines(lines, inLeft, inRight, damping) {
  let sum = 0;
  for (const line of lines) {
    line.damped += damping * (line.memory[line.index] - line.damped);
    sum += line.damped;
  }
  const spread = (2 / lines.length) * sum;
  let outLeft = 0;
  let outRight = 0;
  lines.forEach((line, n) => {
    const out = line.damped;
    if (n % 2 === 0) outLeft += n % 4 === 0 ? out : -out;
    else outRight += n % 4 === 1 ? out : -out;
    const input = n % 2 === 0 ? inLeft : inRight;
    line.memory[line.index] = input + (out - spread) * line.feedback;
    line.index = (line.index + 1) % line.memory.length;
  });
  return [outLeft, outRight];
}

/** Returns the wet signal only, the same length as the input. */
export function reverb(send, decaySeconds) {
  const wet = createStereo(send.left.length / SAMPLE_RATE);
  const lines = createLines(decaySeconds);
  const diffusers = DIFFUSER_SAMPLES.map((pair) => pair.map(createAllpass));
  const damping = onePole(DAMPING_HZ, SAMPLE_RATE);
  const predelay = Math.round(PREDELAY_SECONDS * SAMPLE_RATE);
  for (let i = predelay; i < wet.left.length; i += 1) {
    const inLeft = diffusers[0][1](diffusers[0][0](send.left[i - predelay]));
    const inRight = diffusers[1][1](diffusers[1][0](send.right[i - predelay]));
    const [outLeft, outRight] = stepLines(lines, inLeft, inRight, damping);
    wet.left[i] = outLeft * 0.5;
    wet.right[i] = outRight * 0.5;
  }
  return wet;
}
