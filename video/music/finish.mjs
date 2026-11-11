// Brings a mastered mix to its cut's loudness target and writes the files.
// The loudness is measured by ffmpeg (EBU R128) on the written WAV itself,
// and the gain corrected until the file measures on target.

import { dbToGain, peakDb } from "./dsp/buffers.mjs";
import { limit } from "./dsp/limiter.mjs";
import { encodeAac, measureLoudness } from "./io/ffmpeg.mjs";
import { writeWav } from "./io/wav.mjs";

const TOLERANCE_LU = 0.05;
const MAX_PASSES = 6;

function scaled(buffer, gainDb) {
  const gain = dbToGain(gainDb);
  return {
    left: buffer.left.map((v) => v * gain),
    right: buffer.right.map((v) => v * gain),
  };
}

/**
 * loudness is { targetLufs, truePeakLimitDb, sampleCeilingDb }. Sample peaks
 * are held a little under the true-peak limit because the true
 * (between-samples) peak ffmpeg reports can sit above the highest sample.
 */
export function finish(mix, wavPath, loudness) {
  let gainDb = -12 - peakDb(mix);
  for (let pass = 1; pass <= MAX_PASSES; pass += 1) {
    const limited = limit(
      scaled(mix, gainDb),
      dbToGain(loudness.sampleCeilingDb),
    );
    writeWav(wavPath, limited.buffer);
    const measured = measureLoudness(wavPath);
    const onTarget =
      Math.abs(measured.integrated - loudness.targetLufs) <= TOLERANCE_LU;
    if (onTarget && measured.truePeak <= loudness.truePeakLimitDb) {
      encodeAac(wavPath, wavPath.replace(/\.wav$/, ".m4a"));
      return {
        ...measured,
        gainDb,
        limitedSamples: limited.reducedSamples,
        deepestLimitDb: limited.deepestDb,
        passes: pass,
      };
    }
    gainDb += loudness.targetLufs - measured.integrated;
  }
  throw new Error(
    `${wavPath}: could not reach ${loudness.targetLufs} LUFS under ${loudness.truePeakLimitDb} dBTP`,
  );
}
