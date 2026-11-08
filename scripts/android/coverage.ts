// Reads the Kotlin tests' JaCoCo report and fails below 80% lines or
// branches in the packages that decide (the plain-Kotlin core, the WebView
// check). The Android glue (activity, WebViews) is checked on a device.
// Usage: node scripts/android/coverage.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPORT = join(
  import.meta.dirname,
  "..",
  "..",
  "packages/android/app/build/reports/coverage/test/debug/report.xml",
);
const GATED = ["dev/modulelibrary/app/core", "dev/modulelibrary/app/web"];
/** Android glue in a gated package, left to the device checks. */
const GLUE = new Set(["dev/modulelibrary/app/web/SupportNotice.kt"]);
const MIN = 80;

interface Count {
  missed: number;
  covered: number;
}

const xml = readFileSync(REPORT, "utf8");
const totals = new Map<string, { line: Count; branch: Count }>();

for (const pkgMatch of xml.matchAll(
  /<package name="([^"]+)">([\s\S]*?)<\/package>/g,
)) {
  const [, pkg = "", pkgBody = ""] = pkgMatch;
  if (!GATED.includes(pkg)) continue;
  const t = {
    line: { missed: 0, covered: 0 },
    branch: { missed: 0, covered: 0 },
  };
  for (const file of pkgBody.matchAll(
    /<sourcefile name="([^"]+)">([\s\S]*?)<\/sourcefile>/g,
  )) {
    const [, name = "", body = ""] = file;
    if (GLUE.has(`${pkg}/${name}`)) continue;
    for (const c of body.matchAll(
      /<counter type="(LINE|BRANCH)" missed="(\d+)" covered="(\d+)"\/>/g,
    )) {
      const into = c[1] === "LINE" ? t.line : t.branch;
      into.missed += Number(c[2]);
      into.covered += Number(c[3]);
    }
  }
  totals.set(pkg, t);
}

const pct = (c: Count): number =>
  c.missed + c.covered === 0 ? 100 : (100 * c.covered) / (c.missed + c.covered);

let failed = false;
for (const [pkg, t] of totals) {
  const line = pct(t.line);
  const branch = pct(t.branch);
  const ok = line >= MIN && branch >= MIN;
  failed ||= !ok;
  console.log(
    `${ok ? "ok  " : "LOW "} ${pkg}: lines ${line.toFixed(1)}%, branches ${branch.toFixed(1)}%`,
  );
}
if (failed) process.exit(1);
