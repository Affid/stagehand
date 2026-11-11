// node render.mjs [synth] [simple] [sampled]   renders cut A (all three when
//                                              none is named)
// node render.mjs b [synth] [sampled]          renders cut B
// Files go to video/public/audio as WAV and M4A.

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CUTS, parseCutArgs } from "./cuts.mjs";
import { peakDb, rmsDb } from "./dsp/buffers.mjs";
import { finish } from "./finish.mjs";
import { master, mixStems } from "./mix.mjs";
import { synthStems } from "./synth/stems.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const AUDIO_DIR = join(HERE, "..", "public", "audio");

export async function stemsFor(cut, name) {
  const { engine, notes } = cut.versions[name];
  if (engine === "synth") return synthStems(notes, cut.seconds);
  // Loaded only when asked for, so the synth versions need no npm install.
  const { sampledStems } = await import("./sampled/stems.mjs");
  return sampledStems(notes, cut.seconds, cut.patches);
}

function describeStems(stems) {
  return Object.entries(stems)
    .map(
      ([inst, stem]) =>
        `${inst} rms ${rmsDb(stem).toFixed(1)} crest ${(peakDb(stem) - rmsDb(stem)).toFixed(1)}`,
    )
    .join("; ");
}

async function renderVersion(cut, name) {
  const started = performance.now();
  const label = cut === CUTS.a ? name : `${cut.id}-${name}`;
  const stems = await stemsFor(cut, name);
  console.log(`${label}: stems as rendered (dB): ${describeStems(stems)}`);
  const wavPath = join(AUDIO_DIR, `${cut.filePrefix}-${name}.wav`);
  const result = finish(
    master(mixStems(stems, cut), cut),
    wavPath,
    cut.loudness,
  );
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  console.log(
    `${label}: ${result.integrated} LUFS, LRA ${result.range} LU, true peak ${result.truePeak} dBFS, ` +
      `gain ${result.gainDb.toFixed(2)} dB, ${result.limitedSamples} samples limited (deepest ${result.deepestLimitDb.toFixed(1)} dB), ${seconds} s`,
  );
}

async function main() {
  const { cut, names } = parseCutArgs(process.argv.slice(2));
  mkdirSync(AUDIO_DIR, { recursive: true });
  for (const name of names) await renderVersion(cut, name);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
