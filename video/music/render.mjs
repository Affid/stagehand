// node render.mjs [synth] [simple] [sampled]: renders the named versions
// (all three when none is named) to video/public/audio as WAV and M4A.

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { peakDb, rmsDb } from "./dsp/buffers.mjs";
import { finish } from "./finish.mjs";
import { master, mixStems } from "./mix.mjs";
import { NOTES, notesFor, SIMPLE_INSTRUMENTS } from "./score.mjs";
import { synthStems } from "./synth/stems.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const AUDIO_DIR = join(HERE, "..", "public", "audio");

const VERSIONS = {
  synth: async () => synthStems(NOTES),
  simple: async () => synthStems(notesFor(SIMPLE_INSTRUMENTS)),
  // Loaded only when asked for, so the synth versions need no npm install.
  sampled: async () =>
    (await import("./sampled/stems.mjs")).sampledStems(NOTES),
};

function describeStems(stems) {
  return Object.entries(stems)
    .map(
      ([inst, stem]) =>
        `${inst} rms ${rmsDb(stem).toFixed(1)} crest ${(peakDb(stem) - rmsDb(stem)).toFixed(1)}`,
    )
    .join("; ");
}

async function renderVersion(name) {
  const started = performance.now();
  const stems = await VERSIONS[name]();
  console.log(`${name}: stems as rendered (dB): ${describeStems(stems)}`);
  const result = finish(
    master(mixStems(stems)),
    join(AUDIO_DIR, `music-${name}.wav`),
  );
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  console.log(
    `${name}: ${result.integrated} LUFS, LRA ${result.range} LU, true peak ${result.truePeak} dBFS, ` +
      `gain ${result.gainDb.toFixed(2)} dB, ${result.limitedSamples} samples limited, ${seconds} s`,
  );
}

const asked = process.argv.slice(2);
const names = asked.length > 0 ? asked : Object.keys(VERSIONS);
const unknown = names.filter((name) => !(name in VERSIONS));
if (unknown.length > 0) {
  console.error(
    `Unknown version: ${unknown.join(", ")}. Choose from ${Object.keys(VERSIONS).join(", ")}.`,
  );
  process.exit(1);
}
mkdirSync(AUDIO_DIR, { recursive: true });
for (const name of names) await renderVersion(name);
