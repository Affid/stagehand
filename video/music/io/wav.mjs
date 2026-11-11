// Writes 16-bit stereo PCM WAV. Rounding to 16 bits adds a faint distortion
// to quiet tails, so a triangular dither of one step is added wherever there
// is signal; exact digital silence is left as silence.

import { writeFileSync } from "node:fs";
import { SAMPLE_RATE } from "../dsp/buffers.mjs";
import { createNoise } from "../dsp/shapes.mjs";

const HEADER_BYTES = 44;
const FULL_SCALE = 32767;

function header(dataBytes) {
  const bytes = Buffer.alloc(HEADER_BYTES);
  bytes.write("RIFF", 0);
  bytes.writeUInt32LE(36 + dataBytes, 4);
  bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(2, 22);
  bytes.writeUInt32LE(SAMPLE_RATE, 24);
  bytes.writeUInt32LE(SAMPLE_RATE * 4, 28);
  bytes.writeUInt16LE(4, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(dataBytes, 40);
  return bytes;
}

export function writeWav(path, buffer) {
  const frames = buffer.left.length;
  const data = Buffer.alloc(frames * 4);
  const noise = createNoise(20261111);
  const quantise = (value) => {
    if (value === 0) return 0;
    const dithered = value * FULL_SCALE + (noise() + noise()) / 2;
    return Math.max(-FULL_SCALE, Math.min(FULL_SCALE, Math.round(dithered)));
  };
  for (let i = 0; i < frames; i += 1) {
    data.writeInt16LE(quantise(buffer.left[i]), i * 4);
    data.writeInt16LE(quantise(buffer.right[i]), i * 4 + 2);
  }
  writeFileSync(path, Buffer.concat([header(data.length), data]));
}
