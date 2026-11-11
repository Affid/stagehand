// @vitest-environment happy-dom
// Foundry's "unsupported on Chromium version less than…" notice, taken
// away in the app (owner, 2026-11-11): the app says so itself at start.
import { afterEach, describe, expect, test } from "vitest";
import type { PageGlobals } from "../../src/page/globals.ts";
import { hideBrowserNotice } from "../../src/page/browser-notice.ts";

const KEY = "ERROR.BrowserVersion";
const PATTERN =
  "Foundry Virtual Tabletop uses modern JavaScript features which are unsupported on {browser} version less than {minimum}. You are using {browser} version {version}. Please update or use a different browser.";
const TEXT = PATTERN.replace(/\{browser\}/g, "Chromium")
  .replace("{minimum}", "146")
  .replace("{version}", "145");

function setUp(items: readonly [number, string, boolean][]) {
  const ol = document.createElement("ol");
  ol.id = "notifications";
  document.body.append(ol);
  for (const [id, text, permanent] of items) {
    const li = document.createElement("li");
    li.className = `notification error${permanent ? " permanent" : ""}`;
    li.dataset.id = String(id);
    li.textContent = text;
    ol.append(li);
  }
  const removed: number[] = [];
  const format = (key: string, data: object): string =>
    key === KEY
      ? PATTERN.replace(/\{(\w+)\}/g, (_m, name: string) =>
          String((data as Record<string, unknown>)[name]),
        )
      : key;
  const page = {
    game: { i18n: { format } },
    ui: { notifications: { remove: (id: number) => removed.push(id) } },
  } as unknown as PageGlobals;
  return { page, removed };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("hideBrowserNotice", () => {
  test("removes Foundry's browser-version notice, whatever the versions, and only it", () => {
    const s = setUp([
      [1, TEXT, true],
      [2, TEXT.replace("145", "133"), true],
      [3, "Foundry Virtual Tabletop requires a usable window", true],
      [4, "Please update or use a different browser.", true],
      [5, TEXT, false],
    ]);
    hideBrowserNotice(s.page, document)();
    expect(s.removed).toEqual([1, 2]);
  });

  test("leaves everything while Foundry has no translation to tell it by", () => {
    const s = setUp([[1, TEXT, true]]);
    const page = { ui: s.page.ui } as PageGlobals;
    hideBrowserNotice(page, document)();
    expect(s.removed).toEqual([]);
  });

  test("a translation without the versions in it matches nothing", () => {
    const s = setUp([[1, "ERROR.BrowserVersion", true]]);
    const page = {
      ui: s.page.ui,
      game: { i18n: { format: (key: string) => key } },
    } as unknown as PageGlobals;
    hideBrowserNotice(page, document)();
    expect(s.removed).toEqual([]);
  });
});
