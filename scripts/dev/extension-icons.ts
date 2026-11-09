// Draws the Chrome extension's icons (static/icons/icon-<size>.png) from
// Stagehand's mark, Fly rope (design/app-icon): the bold drawing at 16 and
// 32 px, the full one at 48 and 128 (128 with Chrome's 16 px clear margin).
// The spec is FLY in design/app-icon/index.html; this script, the Android
// drawables (res/drawable/ic_launcher_*.xml) and the home page's Mark
// (app-home/icons.tsx) copy it. Run again after the mark changes:
// node scripts/dev/extension-icons.ts
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const OUT = join(
  import.meta.dirname,
  "..",
  "..",
  "packages",
  "extension",
  "static",
  "icons",
);
const GROUND = "#2a2340";

const FULL = `
  <rect x="35" y="27.5" width="38" height="3.6" fill="#5a4d78"/>
  <rect x="52.4" y="30.6" width="3.2" height="4.4" fill="#8f86a0"/>
  <circle cx="54" cy="43" r="9.6" fill="#d9a441"/>
  <circle cx="54" cy="43" r="6.6" fill="#9c7024"/>
  <circle cx="54" cy="43" r="2.6" fill="#efe3c8"/>
  <path d="M44.4,76 V43 A9.6,9.6 0 0 1 63.6,43 V61" fill="none" stroke="#efe3c8" stroke-width="3.2"/>
  <circle cx="44.4" cy="79" r="2.8" fill="none" stroke="#efe3c8" stroke-width="2.2"/>
  <path fill="#c0584a" d="M63.6,60 C58,64 56,72 57,76.5 Q63.6,82 70.2,76.5 C71.2,72 69.2,64 63.6,60 Z"/>
  <rect x="60" y="63.2" width="7.2" height="2.2" fill="#8e3329"/>`;

const SMALL = `
  <rect x="33" y="26" width="42" height="4.5" fill="#6a5b8c"/>
  <circle cx="54" cy="41" r="11" fill="#d9a441"/>
  <circle cx="54" cy="41" r="4.5" fill="${GROUND}"/>
  <path d="M43,77 V41 A11,11 0 0 1 65,41 V60" fill="none" stroke="#efe3c8" stroke-width="4.6"/>
  <path fill="#c0584a" d="M65,58 C58.5,62.5 56.5,71 57.5,76 Q65,82.5 72.5,76 C73.5,71 71.5,62.5 65,58 Z"/>`;

interface Icon {
  readonly size: number;
  /** The tile's side inside the transparent square. */
  readonly tile: number;
  readonly art: string;
}

const ICONS: readonly Icon[] = [
  { size: 16, tile: 16, art: SMALL },
  { size: 32, tile: 32, art: SMALL },
  { size: 48, tile: 48, art: FULL },
  { size: 128, tile: 96, art: FULL },
];

const page = (i: Icon): string => {
  const pad = (i.size - i.tile) / 2;
  return `<body style="margin:0;background:transparent">
    <div id="icon" style="width:${i.size}px;height:${i.size}px;padding:${pad}px;box-sizing:border-box">
      <svg width="${i.tile}" height="${i.tile}" viewBox="22 21 64 64" style="display:block">
        <rect x="22" y="21" width="64" height="64" rx="12" fill="${GROUND}"/>${i.art}
      </svg>
    </div></body>`;
};

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
try {
  const tab = await browser.newPage({ deviceScaleFactor: 1 });
  for (const icon of ICONS) {
    await tab.setContent(page(icon));
    const file = join(OUT, `icon-${icon.size}.png`);
    await tab.locator("#icon").screenshot({ path: file, omitBackground: true });
    console.log(`wrote ${file}`);
  }
} finally {
  await browser.close();
}
