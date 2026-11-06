// Build the Setup page mockup into out/: one self-contained page plus the playground wrapper.
// Foundry's own CSS, fonts and images are read from fvtt/ (not in git; see assets.sh).
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const dir = new URL(".", import.meta.url).pathname;
const read = (f) => readFileSync(`${dir}${f}`, "utf8");
if (!existsSync(`${dir}fvtt/css/foundry2.css`)) {
  console.error("fvtt/ is missing. Run ./assets.sh first (it copies Foundry's own assets from your install).");
  process.exit(1);
}

const data = read("src/_data.js").replace("/*MODULES_JSON*/[]", () => read("dom/modules.json"));
const SHELL_CSS = ["_shell", "_ideas", "_calm", "_sched", "_server", "_config"].map((f) => read(`src/${f}.css`)).join("\n");
const SHELL_JS = ["_shell", "_ideas", "_calm", "_sched", "_server", "_config", "_tips", "_news", "_boot"].map((f) => read(`src/${f}.js`)).join("\n");
const HEAD = `<link href="fvtt/css/foundry2.css" rel="stylesheet"><style>@import "fvtt/fonts/fontawesome/css/all.min.css" layer(variables);</style>`;

const page = read("src/setup-shell.html")
  .replace("<!--FOUNDRY_HEAD-->", () => HEAD)
  .replace("/*KIT_CSS*/", () => read("src/_kit.css"))
  .replace("/*KIT_JS*/", () => `${data}\n${read("src/_kit.js")}`)
  .replace("/*SHELL_CSS*/", () => SHELL_CSS)
  .replace("/*SHELL_JS*/", () => SHELL_JS);

mkdirSync(`${dir}out/shots`, { recursive: true });
writeFileSync(`${dir}out/setup-shell.html`, page);
cpSync(`${dir}playground.html`, `${dir}out/index.html`);
cpSync(`${dir}fvtt`, `${dir}out/fvtt`, { recursive: true });
console.log("built out/setup-shell.html and out/index.html (open out/index.html)");
