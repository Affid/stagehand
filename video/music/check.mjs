// node check.mjs: measures every rendered version, since nobody making this
// can listen to it. Prints format, loudness, the level of the first and last
// moments, a level-per-second strip, the largest sample-to-sample jump (a
// click would show as a large one), and writes a spectrogram to out/.

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { measureLoudness, probe, spectrogram } from "./io/ffmpeg.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const AUDIO_DIR = join(HERE, "..", "public", "audio");
const OUT_DIR = join(HERE, "out");
const RATE = 48000;
const HEADER_BYTES = 44;

function readSamples(path) {
  const bytes = readFileSync(path).subarray(HEADER_BYTES);
  return new Int16Array(bytes.buffer, bytes.byteOffset, bytes.length / 2);
}

function rmsDb(samples, fromSeconds, toSeconds) {
  const slice = samples.subarray(
    Math.round(fromSeconds * RATE) * 2,
    Math.round(toSeconds * RATE) * 2,
  );
  const sum = slice.reduce((total, value) => total + (value / 32768) ** 2, 0);
  return sum === 0 ? -Infinity : 10 * Math.log10(sum / slice.length);
}

function largestJump(samples) {
  let jump = 0;
  let at = 0;
  for (let i = 2; i < samples.length; i += 1) {
    const step = Math.abs(samples[i] - samples[i - 2]);
    if (step > jump) [jump, at] = [step, i];
  }
  return `${(jump / 32768).toFixed(4)} of full scale at ${(at / 2 / RATE).toFixed(3)} s`;
}

function meanOffset(samples) {
  return (
    samples.reduce((total, value) => total + value, 0) / samples.length / 32768
  );
}

function report(name) {
  const path = join(AUDIO_DIR, `music-${name}.wav`);
  if (!existsSync(path)) return;
  const samples = readSamples(path);
  const seconds = samples.length / 2 / RATE;
  const format = probe(path);
  const loudness = measureLoudness(path);
  const strip = Array.from({ length: Math.floor(seconds) }, (_, s) =>
    Math.round(rmsDb(samples, s, s + 1)),
  );
  spectrogram(path, join(OUT_DIR, `spectrogram-${name}.png`));
  console.log(
    `\n${name}: ${format.codec_name}, ${format.sample_rate} Hz, ${format.channels} ch, ${format.duration} s`,
  );
  console.log(
    `  integrated ${loudness.integrated} LUFS, LRA ${loudness.range} LU, true peak ${loudness.truePeak} dBFS`,
  );
  console.log(
    `  first 50 ms ${rmsDb(samples, 0, 0.05).toFixed(1)} dB, first 250 ms ${rmsDb(samples, 0, 0.25).toFixed(1)} dB`,
  );
  console.log(
    `  40.0-40.5 s ${rmsDb(samples, 40, 40.5).toFixed(1)} dB, last 100 ms ${rmsDb(samples, seconds - 0.1, seconds).toFixed(1)} dB`,
  );
  console.log(
    `  DC offset ${meanOffset(samples).toExponential(1)}, largest jump ${largestJump(samples)}`,
  );
  console.log(`  RMS dB per second: ${strip.join(" ")}`);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const name of ["synth", "sampled", "simple"]) report(name);
