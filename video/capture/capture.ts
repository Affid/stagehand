// Captures everything the video is built from, off the demo server
// (scripts/demo/setup-demo.ts), into video/public/capture:
//   FOUNDRY_PORT=30015 FOUNDRY_DATA_DIR=~/foundry/data-demo \
//     node video/capture/capture.ts
// Needs the release build of the extension (packages/extension:
// pnpm build:release). Pages and Stagehand's cards are taken at 3x so the
// video can move in on them; the two very tall pages at 2x.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { VIEWPORT } from "./browser.ts";
import { OUT } from "./shots.ts";
import {
  captureLibrary,
  captureWalk,
  MODULE,
  NOTED,
  WORLD,
} from "./stagehand.ts";
import { captureStock } from "./stock.ts";

const PAGE_SCALE = 3;
/** Foundry's cards are only ever shown small; Stagehand's also step forward. */
const STOCK_CARD_SCALE = 2;
const CARD_SCALE = 3;
const TALL_SCALE = 2;

const stock = await captureStock(STOCK_CARD_SCALE, false);
await captureStock(PAGE_SCALE, true);
const library = await captureLibrary(CARD_SCALE, "pieces");
await captureLibrary(PAGE_SCALE, "page");
await captureLibrary(TALL_SCALE, "tall");
const walk = await captureWalk(PAGE_SCALE);

writeFileSync(
  join(OUT, "capture.json"),
  `${JSON.stringify(
    {
      viewport: VIEWPORT,
      pageScale: PAGE_SCALE,
      cardScale: CARD_SCALE,
      tallScale: TALL_SCALE,
      world: WORLD,
      module: MODULE,
      noted: NOTED,
      stock,
      library,
      walk,
    },
    null,
    1,
  )}\n`,
);
console.log(
  `Captured ${stock.cards.length} cards on Foundry's page, ${library.cards.length} on Stagehand's.`,
);
