// Links the companion module's dist/ and the fixture modules into Foundry's
// Data/modules/<id>. Leaves anything that is not our link alone.
import { lstat, mkdir, readdir, readlink, symlink } from "node:fs/promises";
import { join } from "node:path";
import { loadFoundryEnv } from "./env.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const modulesDir = join(loadFoundryEnv().dataDir, "Data", "modules");
const fixturesDir = join(ROOT, "fixtures", "modules");

const links: readonly (readonly [string, string])[] = [
  ["module-library", join(ROOT, "packages", "module", "dist")],
  ...(await readdir(fixturesDir)).map(
    (id) => [id, join(fixturesDir, id)] as const,
  ),
];

await mkdir(modulesDir, { recursive: true });
for (const [id, target] of links) {
  const link = join(modulesDir, id);
  const existing = await lstat(link).catch(() => undefined);
  if (existing?.isSymbolicLink() && (await readlink(link)) === target) {
    console.log(`${id}: already linked`);
  } else if (existing) {
    console.error(
      `${id}: ${link} exists and is not our link; leaving it alone`,
    );
    process.exitCode = 1;
  } else {
    await symlink(target, link, "dir");
    console.log(`${id}: linked ${link} -> ${target}`);
  }
}
