// SETUP-REDESIGN.md build requirements on the local Foundry (Phase 6,
// acceptance), as the prototype's checks/shifts.mjs and cfgtyping.mjs:
// nothing moves under the pointer when a bar appears, a click right after
// typing lands, and disabled controls explain themselves on a wrapper.
import { expect, type Locator, type Page, test } from "@playwright/test";
import { loadFoundryEnv } from "../../scripts/foundry/env.ts";
import { TEST_WORLD } from "../../scripts/foundry/world.ts";
import {
  loadTarget,
  openSetupAsAdmin,
  type Target,
  updateStored,
} from "./target.ts";

const env = loadFoundryEnv();
let ext: Target;
let page: Page;

const shell = (p: Page) => p.locator("#ml-shell-root");
const main = (p: Page) => shell(p).locator(".mls-main");

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  ext = await loadTarget();
  page = await ext.context.newPage();
  await page.setViewportSize({ width: 1366, height: 768 });
  await openSetupAsAdmin(ext, page, env.url, env.adminPassword);
});

test.afterAll(async () => {
  await ext.close();
});

const topOf = async (l: Locator): Promise<number> =>
  Math.round((await l.boundingBox())?.y ?? -1);

/** `act` must leave `still` where it was. */
async function stays(still: Locator, act: () => Promise<void>): Promise<void> {
  const before = await topOf(still);
  await act();
  await page.waitForTimeout(300);
  expect(await topOf(still)).toBe(before);
}

async function seedSnapshot(): Promise<void> {
  const active = ["stagehand", "ml-fixture-lib"].map((m) => ({
    id: m,
    version: "1.0.0",
  }));
  const snap = {
    worldId: TEST_WORLD.id,
    title: TEST_WORLD.title,
    system: { id: "dnd5e", version: "1" },
    coreVersion: "14.370",
    active,
    companionVersion: "0.1.0",
    takenAt: new Date().toISOString(),
  };
  await updateStored<Record<string, unknown>>(
    ext,
    `snapshots:${env.url}`,
    (all) => ({ ...all, [TEST_WORLD.id]: snap }),
  );
}

test("a world: the first queued change adds the banner's line without moving the cards", async () => {
  await seedSnapshot();
  await page.reload();
  await shell(page)
    .locator(`.mls-world[data-world="${TEST_WORLD.id}"]`)
    .click();
  const cards = main(page).locator(".mlw-card");
  await stays(cards.last(), () =>
    cards.first().locator('input[role="switch"]').click(),
  );
  await expect(main(page).locator(".mls-banner")).toContainText("wait");
  // Only changes and problems get a coloured edge: a module simply on and
  // one simply off share the neutral one.
  const edge = (l: Locator) =>
    l.evaluate((e) => getComputedStyle(e).borderLeftColor);
  const plainOn = main(page)
    .locator(".mlw-card.on:not(.plus):not(.minus):not(.risk):not(.prob)")
    .first();
  const plainOff = main(page)
    .locator(".mlw-card.off:not(.plus):not(.minus):not(.risk):not(.prob)")
    .first();
  expect(await edge(plainOn)).toBe(await edge(plainOff));
  await main(page).getByRole("button", { name: "Discard" }).click();
});

test("the Library: Select's bar replaces the toolbar; picking a card moves nothing", async () => {
  await shell(page).locator(".mls-lib").click();
  const first = main(page).locator(".mll-card").first();
  await stays(first, () =>
    main(page).getByRole("button", { name: "Select" }).click(),
  );
  await stays(first, () =>
    main(page).locator(".mll-card input[type=checkbox]").nth(1).check(),
  );
  await main(page).getByRole("button", { name: "None" }).click();
  await main(page).getByRole("button", { name: "Done" }).click();
});

test("Configuration: the not-saved bar appears in its own slot; clicks right after typing land", async () => {
  await shell(page)
    .locator(".mls-top")
    .getByRole("button", { name: "Configuration" })
    .click();
  const port = main(page).getByRole("spinbutton", { name: /Port/ }).first();
  const original = await port.inputValue();
  const section = main(page).locator(".mlc-set, section").first();
  // Typing and then clicking UPnP at once: the click lands, the text stays.
  const upnp = main(page).getByRole("checkbox", { name: "UPnP" });
  const was = await upnp.isChecked();
  await stays(section, async () => {
    await port.fill("30001");
    await upnp.click();
  });
  expect(await upnp.isChecked()).toBe(!was);
  expect(await port.inputValue()).toBe("30001");
  await expect(
    main(page).getByRole("button", { name: /^Save/ }).first(),
  ).toBeVisible();
  // Put both back: the bar goes, nothing saved.
  await upnp.click();
  await port.fill(original);
  await port.blur();
  await expect(main(page).getByRole("button", { name: /^Save/ })).toHaveCount(
    0,
  );
});

/** Deletes one backup row with the code Foundry shows. */
async function deleteBackup(row: Locator): Promise<void> {
  await row.getByRole("button", { name: /^Delete/ }).click();
  const dialog = page.locator("dialog.application", {
    has: page.locator("#delete-confirm"),
  });
  const code = await dialog.locator("#confirm-code .reference").textContent();
  await dialog.locator("#delete-confirm").fill(code ?? "");
  await dialog.locator('[data-action="yes"]').click();
  await expect(dialog).toHaveCount(0);
}

/** Takes a backup with a note through Foundry's own prompt. */
async function takeBackup(tab: Locator, note: string): Promise<void> {
  await tab
    .getByRole("button", {
      name: /^(Take a backup|Take the first backup|Back up now)$/,
    })
    .first()
    .click();
  const prompt = page.locator("dialog.application").last();
  await prompt.locator("input").fill(note);
  await prompt
    .locator('button[data-action="ok"], button[type="submit"]')
    .first()
    .click();
}

test("a world's Backups: Foundry's progress row leaves the button that started it in place", async () => {
  const stamp = String(Date.now());
  const first = `Module Library steady test A ${stamp}`;
  const second = `Module Library steady test B ${stamp}`;
  await shell(page)
    .locator(`.mls-world[data-world="${TEST_WORLD.id}"]`)
    .click();
  await main(page)
    .getByRole("tab", { name: /Backups/ })
    .click();
  const tab = main(page).locator(".mlw-backups");
  await expect(tab.getByText("Reading Foundry's backups…")).toHaveCount(0);
  await takeBackup(tab, first);
  const a = tab.locator(".mlw-blist li", { hasText: first });
  await expect(a).toHaveCount(1, { timeout: 120_000 });
  // Sample the head's button in the page while the second backup runs.
  await page.evaluate(() => {
    const w = window as unknown as { mlSamples: string[] };
    w.mlSamples = [];
    const tick = (): void => {
      const busy = document.querySelector(".mlw-blist li.busy");
      const btn = [...document.querySelectorAll(".mlw-backups button")].find(
        (b) => /^(Take a backup|Back up now)$/.test(b.textContent.trim()),
      );
      if (busy && btn)
        w.mlSamples.push(String(Math.round(btn.getBoundingClientRect().y)));
      if (w.mlSamples.length < 400) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const resting = await topOf(
    tab.getByRole("button", { name: /^(Take a backup|Back up now)$/ }).first(),
  );
  await takeBackup(tab, second);
  const b = tab.locator(".mlw-blist li", { hasText: second });
  await expect(b).toHaveCount(1, { timeout: 120_000 });
  const samples = await page.evaluate(
    () => (window as unknown as { mlSamples: string[] }).mlSamples,
  );
  expect(samples.length).toBeGreaterThan(0);
  expect(new Set(samples)).toEqual(new Set([String(resting)]));
  await deleteBackup(b);
  await expect(b).toHaveCount(0, { timeout: 60_000 });
  await deleteBackup(a);
  await expect(a).toHaveCount(0, { timeout: 60_000 });
});

test("disabled controls with a reason carry it on a wrapper that gets the hover", async () => {
  const pages: (() => Promise<void>)[] = [
    () => shell(page).locator(".mls-world").first().click(),
    () => shell(page).locator(".mls-lib").click(),
    () =>
      shell(page)
        .locator(".mls-top")
        .getByRole("button", { name: "Backups" })
        .click(),
  ];
  for (const open of pages) {
    await open();
    await page.waitForTimeout(500);
    const bare = await main(page).evaluate((m) =>
      [...m.querySelectorAll<HTMLButtonElement>("button:disabled[title]")]
        .filter((b) => !b.parentElement?.closest("[title]"))
        .map((b) => `${b.textContent.trim()} (${b.title})`),
    );
    expect(bare).toEqual([]);
  }
});
