// Lay screenshots side by side into one image (dev aid for the phone mockups).
// Usage: node tools/sheet.mjs <out.png> <a.png> <b.png> ...
import { writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
const [out, ...files] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 420 * files.length, height: 940 } });
writeFileSync(`${out}.html`, `<body style="margin:0;display:flex;gap:8px;background:#fff">${files.map((f) => `<img src="file://${f}" style="width:412px">`).join("")}</body>`);
await p.goto(`file://${out}.html`);
await p.waitForTimeout(300); await p.screenshot({ path: out, fullPage: true }); await b.close();
