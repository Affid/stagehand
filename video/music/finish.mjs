// Brings a mastered mix to the loudness target and writes the files. The
// loudness is measured by ffmpeg (EBU R128) on the written WAV itself, and
// the gain corrected until the file measures on target.

import { dbToGain, peakDb } from "./dsp/buffers.mjs";
import { limit } from "./dsp/limiter.mjs";
import { encodeAac, measureLoudness } from "./io/ffmpeg.mjs";
import { writeWav } from "./io/wav.mjs";

export const TARGET_LUFS = -20;
export const TRUE_PEAK_LIMIT_DB = -3;
// Sample peaks are held a little under the limit because the true
// (between-samples) peak ffmpeg reports can sit above the highest sample.
const SAMPLE_CEILING_DB = -4;
const TOLERANCE_LU = 0.05;
const MAX_PASSES = 6;

function scaled(buffer, gainDb) {
  const gain = dbToGain(gainDb);
  return {
    left: buffer.left.map((v) => v * gain),
    right: buffer.right.map((v) => v * gain),
  };
}

export function finish(mix, wavPath) {
  let gainDb = -12 - peakDb(mix);
  for (let pass = 1; pass <= MAX_PASSES; pass += 1) {
    const limited = limit(scaled(mix, gainDb), dbToGain(SAMPLE_CEILING_DB));
    writeWav(wavPath, limited.buffer);
    const measured = measureLoudness(wavPath);
    const onTarget =
      Math.abs(measured.integrated - TARGET_LUFS) <= TOLERANCE_LU;
    if (onTarget && measured.truePeak <= TRUE_PEAK_LIMIT_DB) {
      encodeAac(wavPath, wavPath.replace(/\.wav$/, ".m4a"));
      return {
        ...measured,
        gainDb,
        limitedSamples: limited.reducedSamples,
        passes: pass,
      };
    }
    gainDb += TARGET_LUFS - measured.integrated;
  }
  throw new Error(
    `${wavPath}: could not reach ${TARGET_LUFS} LUFS under ${TRUE_PEAK_LIMIT_DB} dBTP`,
  );
}
