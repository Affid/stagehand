// Build the in-world library mockup into out/: the playground (index.html),
// the game page it frames (mock.html) with its scripts, and Foundry's assets
// from fvtt/ (not in git; see assets.sh).
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";

const dir = new URL(".", import.meta.url).pathname;
if (!existsSync(`${dir}fvtt/css/foundry2.css`)) {
  console.error("fvtt/ is missing. Run ./assets.sh first (it copies Foundry's own assets from your install).");
  process.exit(1);
}
mkdirSync(`${dir}out/shots`, { recursive: true });
for (const f of readdirSync(`${dir}src`)) {
  const to = f === "playground.html" ? "index.html" : f;
  cpSync(`${dir}src/${f}`, `${dir}out/${to}`);
}
cpSync(`${dir}fvtt`, `${dir}out/fvtt`, { recursive: true });
console.log("built out/index.html (playground) and out/mock.html (the game view)");
