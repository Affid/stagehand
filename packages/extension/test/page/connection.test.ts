// @vitest-environment happy-dom
// Foundry's notices about its own connection, taken away in the app
// (owner, 2026-11-11): coming back to the app showed "lost connection"
// and "re-established" before Foundry reloaded the page.
import { afterEach, describe, expect, test, vi } from "vitest";
import type { PageGlobals } from "../../src/page/globals.ts";
import { hideConnectionNotices } from "../../src/page/connection.ts";

const LOST =
  "You have lost connection to the server, attempting to re-establish.";
const BACK = "Foundry VTT | Server connection re-established.";
const GONE = "Foundry VTT | Server connection lost.";

function area(doc: Document): HTMLElement {
  const ol = doc.createElement("ol");
  ol.id = "notifications";
  doc.body.append(ol);
  return ol;
}

function add(doc: Document, id: number, text: string, kind = "error"): void {
  const li = doc.createElement("li");
  li.className = `notification ${kind}`;
  li.dataset.id = String(id);
  const p = doc.createElement("p");
  p.textContent = text;
  li.append(p);
  doc.getElementById("notifications")?.append(li);
}

function page() {
  const notifications = {
    removed: [] as number[],
    // As Foundry's: it needs `this` (its private queue).
    remove(this: { removed: number[] } | undefined, id: number): void {
      if (!this) throw new TypeError("remove called without its object");
      this.removed.push(id);
    },
  };
  const globals = { ui: { notifications } } as unknown as PageGlobals;
  return { globals, notifications };
}

const settled = () => vi.waitFor(() => undefined);

afterEach(() => {
  document.body.replaceChildren();
});

describe("hideConnectionNotices", () => {
  test("removes the three connection notices that are showing, and only those", () => {
    area(document);
    add(document, 1, "Admin authentication successful", "info");
    add(document, 2, `  ${LOST}\n`);
    add(document, 3, BACK, "info");
    add(document, 4, GONE);
    add(document, 5, "The server connection is slow today");
    const p = page();
    const stop = hideConnectionNotices(p.globals, document);
    expect(p.notifications.removed).toEqual([2, 3, 4]);
    stop();
  });

  test("removes them as Foundry raises them, until stopped", async () => {
    area(document);
    const p = page();
    const stop = hideConnectionNotices(p.globals, document);
    add(document, 7, LOST);
    await vi.waitFor(() => {
      expect(p.notifications.removed).toEqual([7]);
    });
    stop();
    add(document, 8, BACK, "info");
    await settled();
    expect(p.notifications.removed).toEqual([7]);
  });

  test("waits for Foundry's notification area where it comes later", async () => {
    const p = page();
    const stop = hideConnectionNotices(p.globals, document);
    area(document);
    add(document, 9, BACK, "info");
    await vi.waitFor(() => {
      expect(p.notifications.removed).toEqual([9]);
    });
    stop();
  });

  test("another build's name before the bar is taken as Foundry's", () => {
    area(document);
    add(document, 2, "Foundry Virtual Tabletop | Server connection lost.");
    const p = page();
    hideConnectionNotices(p.globals, document)();
    expect(p.notifications.removed).toEqual([2]);
  });

  test("does nothing without Foundry's notifications", () => {
    area(document);
    add(document, 2, LOST);
    expect(() => {
      hideConnectionNotices({}, document)();
    }).not.toThrow();
  });
});
