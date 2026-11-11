// Where the SoundFont lives and where it comes from. It is downloaded into
// .cache (git-ignored), never committed: see README.md for its licence.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

export const SOUNDFONT = {
  name: "GeneralUser GS v2.0.3 by S. Christian Collins",
  dir: join(HERE, "..", ".cache", "generaluser-gs"),
  files: {
    "GeneralUser-GS.sf2":
      "https://raw.githubusercontent.com/mrbumpy409/GeneralUser-GS/main/GeneralUser-GS.sf2",
    "LICENSE.txt":
      "https://raw.githubusercontent.com/mrbumpy409/GeneralUser-GS/main/documentation/LICENSE.txt",
  },
};

export function soundFontPath() {
  return join(SOUNDFONT.dir, "GeneralUser-GS.sf2");
}

export function readSoundFont() {
  const path = soundFontPath();
  if (!existsSync(path)) {
    throw new Error(
      `The SoundFont is missing at ${path}. Run "npm run fetch-soundfont" in video/music first.`,
    );
  }
  const bytes = readFileSync(path);
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
}
