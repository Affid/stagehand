// Dev aid: screenshots of the build beside the prototype, view by view, at
// 1366×768 and 2560×1440, for the Phase 6 results page. JPEG to keep them
// small. Foundry must be running on Setup; the prototype built.
// Usage: node scripts/dev/results-shots.ts [out-dir]
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Locator, type Page } from "@playwright/test";
import {
  type LoadedExtension,
  loadExtension,
  openSetupAsAdmin,
} from "../../tests/foundry/extension.ts";
import { loadFoundryEnv } from "../foundry/env.ts";
import { addMany, removeMany } from "../foundry/many.ts";
import { TEST_WORLD } from "../foundry/world.ts";

const OUT = process.argv[2] ?? "test-results/results";
mkdirSync(OUT, { recursive: true });
const PROTO = `file://${join(import.meta.dirname, "../../design/setup-page/out/setup-shell.html")}?calm=1`;
const SIZES = [
  [1366, 768],
  [2560, 1440],
] as const;

interface View {
  readonly name: string;
  /** Prototype URL params, and clicks after it loads. */
  readonly proto: string;
  readonly protoClicks?: readonly string[];
  /** Opens the same view on the build. */
  readonly build: (root: Locator, page: Page) => Promise<void>;
}

const top = (root: Locator) => root.locator(".mls-top");
const VIEWS: readonly View[] = [
  {
    name: "world",
    proto: "&page=world",
    build: async (root) => {
      await root.locator(`.mls-world[data-world="${TEST_WORLD.id}"]`).click();
      await root
        .locator(".mls-main")
        .getByRole("tab", { name: /Modules/ })
        .click();
    },
  },
  {
    name: "library",
    proto: "&page=library&panel=modular-av",
    build: async (root) => {
      await root.locator(".mls-lib").click();
      await root.locator(".mls-main button.t").first().click();
    },
  },
  {
    name: "byworld",
    proto: "&page=library&worlds=30",
    protoClicks: ["[data-act=lsub][data-id=grid]"],
    build: async (root) => {
      await root
        .locator(".mls-panel")
        .getByRole("button", { name: "Close" })
        .click();
      await root
        .locator(".mls-main")
        .getByRole("tab", { name: /By world/ })
        .click();
    },
  },
  {
    name: "backups",
    proto: "&page=backups",
    build: (root) => top(root).getByRole("button", { name: "Backups" }).click(),
  },
  {
    name: "config",
    proto: "&page=config",
    build: (root) =>
      top(root).getByRole("button", { name: "Configuration" }).click(),
  },
];

async function protoShots(): Promise<void> {
  const b = await chromium.launch();
  try {
    for (const [w, h] of SIZES)
      for (const v of VIEWS) {
        const p = await b.newPage({ viewport: { width: w, height: h } });
        await p.goto(`${PROTO}${v.proto}`);
        await p.waitForTimeout(600);
        for (const sel of v.protoClicks ?? []) await p.click(sel);
        await p.waitForTimeout(300);
        await p.screenshot({
          path: `${OUT}/${v.name}-${String(w)}-proto.jpg`,
          type: "jpeg",
          quality: 72,
        });
        await p.close();
      }
  } finally {
    await b.close();
  }
}

/** The test world with modules (as its companion would report) and one change. */
async function seed(ext: LoadedExtension, url: string): Promise<void> {
  await ext.worker.evaluate(
    async ([k, id, title, now]) => {
      const active = ["stagehand", "ml-fixture-lib", "ml-fixture-a"].map(
        (m) => ({ id: m, version: "1.0.0" }),
      );
      const snap = {
        worldId: id,
        title,
        system: { id: "dnd5e", version: "1" },
        coreVersion: "14.370",
        active,
        companionVersion: "0.1.0",
        takenAt: now,
      };
      await chrome.storage.local.set({ [k]: { [id]: snap } });
      // News: the latest article as not read yet, so News shows open.
      const all = await chrome.storage.local.get(null);
      const nk = Object.keys(all).find((x) => x.startsWith("news-seen:"));
      if (nk)
        await chrome.storage.local.set({
          [nk]: (all[nk] as string[]).slice(1),
        });
    },
    [
      `snapshots:${url}`,
      TEST_WORLD.id,
      TEST_WORLD.title,
      new Date().toISOString(),
    ] as const,
  );
}

async function buildShots(): Promise<void> {
  const env = loadFoundryEnv();
  const ext = await loadExtension();
  try {
    const page = await ext.context.newPage();
    await openSetupAsAdmin(ext, page, env.url, env.adminPassword);
    await seed(ext, env.url);
    for (const [w, h] of SIZES) {
      await page.setViewportSize({ width: w, height: h });
      await page.reload();
      await page.locator("#ml-shell-root .mls-top").waitFor();
      const root = page.locator("#ml-shell-root");
      for (const v of VIEWS) {
        await v.build(root, page);
        await page.mouse.move(0, 0);
        await page.waitForTimeout(800);
        await page.screenshot({
          path: `${OUT}/${v.name}-${String(w)}-build.jpg`,
          type: "jpeg",
          quality: 72,
        });
      }
    }
  } finally {
    await ext.context.close();
  }
}

await protoShots();
await removeMany();
await addMany(30, 120);
try {
  await buildShots();
} finally {
  await removeMany();
}
console.log(`screenshots in ${OUT}`);
