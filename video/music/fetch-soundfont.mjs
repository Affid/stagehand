// Downloads GeneralUser GS and its licence text from the author's GitHub
// repository into .cache/generaluser-gs. Skips files that are already there.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SOUNDFONT } from "./sampled/soundfont.mjs";

const SF2_MAGIC = "RIFF";

async function download(name, url) {
  const target = join(SOUNDFONT.dir, name);
  if (existsSync(target)) {
    console.log(`${name}: already present`);
    return;
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (
    name.endsWith(".sf2") &&
    bytes.subarray(0, 4).toString("latin1") !== SF2_MAGIC
  ) {
    throw new Error(`${url} did not return a SoundFont file`);
  }
  writeFileSync(target, bytes);
  console.log(`${name}: ${bytes.length} bytes`);
}

mkdirSync(SOUNDFONT.dir, { recursive: true });
for (const [name, url] of Object.entries(SOUNDFONT.files))
  await download(name, url);
