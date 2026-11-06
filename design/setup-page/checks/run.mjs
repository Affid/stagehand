// Run every mockup check in turn. Each one drives the built page in Chromium and prints
// what it found; a check fails if it throws or reports page errors.
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";

const dir = new URL(".", import.meta.url).pathname;
const checks = readdirSync(dir).filter((f) => f.endsWith(".mjs") && f !== "run.mjs").sort();
let failed = 0;
for (const f of checks) {
  try {
    const out = execFileSync("node", [`${dir}${f}`], { encoding: "utf8", timeout: 120_000 });
    const bad = /pageerror|Error:|\[\s*'/.test(out.split("\n").slice(-3).join("\n"));
    console.log(`${bad ? "FAIL" : "ok  "} ${f}`);
    if (bad) { failed++; console.log(out.split("\n").slice(-6).join("\n")); }
  } catch (e) {
    failed++;
    console.log(`FAIL ${f}\n${String(e.stderr || e.message).split("\n").slice(0, 4).join("\n")}`);
  }
}
console.log(failed ? `${failed} of ${checks.length} failed` : `all ${checks.length} passed`);
process.exit(failed ? 1 : 0);
