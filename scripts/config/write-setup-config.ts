// Writes config/setup-config.json from the bundled Setup config
// (packages/extension/src/adapters/config.ts). The extension and the app
// read that file from this repository once a day (REMOTE_CONFIG_URL) and use
// it when its revision is newer than the bundled one, so a Foundry build can
// be supported without a release. Usage: pnpm config:write, after changing
// the bundled config; a unit test fails while the two differ.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { BUNDLED_CONFIG } from "../../packages/extension/src/adapters/config.ts";

const path = join(
  import.meta.dirname,
  "..",
  "..",
  "config",
  "setup-config.json",
);
writeFileSync(path, `${JSON.stringify(BUNDLED_CONFIG, null, 2)}\n`);
console.log(`Wrote ${path}`);
