// node stems-report.mjs [a|b] [version...]: how loud each instrument is in
// each section of the film once the mix levels are applied (EBU R128, so
// weighted roughly as the ear weighs it). This is how the balance in
// cuts.mjs was set without listening; -70 means the instrument is silent there.

import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCutArgs } from "./cuts.mjs";
import { dbToGain, rmsDb, scaleStereo } from "./dsp/buffers.mjs";
import { writeWav } from "./io/wav.mjs";
import { stemsFor } from "./render.mjs";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "out");
// Stems are quiet on their own; lift them so the meter's gate does not
// discard them. The same lift on every stem leaves the comparison intact.
const LIFT_DB = 12;

function sectionLoudness(path, from, length) {
  const args = [
    "-hide_banner",
    "-nostats",
    "-ss",
    String(from),
    "-t",
    String(length),
    "-i",
    path,
    "-af",
    "ebur128",
    "-f",
    "null",
    "-",
  ];
  const { stderr } = spawnSync("ffmpeg", args, { encoding: "utf8" });
  const match = /I:\s*(-?[\d.]+)/.exec(
    stderr.slice(stderr.lastIndexOf("Summary:")),
  );
  return match ? (Number(match[1]) - LIFT_DB).toFixed(0).padStart(4) : "   ?";
}

const { cut, names } = parseCutArgs(process.argv.slice(2));
const starts = cut.score.SECTIONS.map((section) => section.start);
mkdirSync(OUT_DIR, { recursive: true });
for (const name of names) {
  console.log(
    `\nCut ${cut.id} ${name}: LUFS per section starting at ${starts.join(", ")} s`,
  );
  for (const [inst, stem] of Object.entries(await stemsFor(cut, name))) {
    scaleStereo(stem, dbToGain(cut.mix[inst].level - rmsDb(stem) + LIFT_DB));
    const path = join(OUT_DIR, `stem-${cut.id}-${name}-${inst}.wav`);
    writeWav(path, stem);
    const row = starts.map((from, index) =>
      sectionLoudness(path, from, (starts[index + 1] ?? cut.seconds) - from),
    );
    console.log(`  ${inst.padEnd(7)} ${row.join(" ")}`);
  }
}
