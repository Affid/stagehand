// @vitest-environment happy-dom
// Foundry's "window smaller than 1024×768" notice, taken away while the
// phone or tablet layout is on (Android plan, phase 3).
import { afterEach, describe, expect, test, vi } from "vitest";
import type { PageGlobals } from "../../src/page/globals.ts";
import { hideResolutionNotice } from "../../src/page/resolution.ts";

const KEY = "ERROR.RESOLUTION.Scale";
const TEXT =
  "Foundry Virtual Tabletop requires a usable window dimensions of 1024px by 768px or greater. The current dimensions of this window are 412px by 915px.";

function notices(doc: Document, items: readonly [number, string][]): void {
  const ol = doc.createElement("ol");
  ol.id = "notifications";
  doc.body.append(ol);
  items.forEach(([id, text]) => {
    add(doc, id, text);
  });
}

function add(doc: Document, id: number, text: string, permanent = true): void {
  const li = doc.createElement("li");
  li.className = `notification error${permanent ? " permanent" : ""}`;
  li.dataset.id = String(id);
  const p = doc.createElement("p");
  p.textContent = text;
  li.append(p);
  doc.getElementById("notifications")?.append(li);
}

function page(issue: unknown = { message: KEY, params: { curWidth: 412 } }) {
  const notifications = {
    removed: [] as number[],
    // As Foundry's: it needs `this` (its private queue).
    remove(this: { removed: number[] } | undefined, id: number): void {
      if (!this) throw new TypeError("remove called without its object");
      this.removed.push(id);
    },
  };
  const remove = vi.spyOn(notifications, "remove");
  const format = vi.fn((key: string) => (key === KEY ? TEXT : key));
  const globals = {
    game: {
      issues: { usabilityIssues: issue ? { resolutionTooLow: issue } : {} },
      i18n: { format },
    },
    ui: { notifications },
  } as unknown as PageGlobals;
  return { globals, remove, format, notifications };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("hideResolutionNotice", () => {
  test("removes Foundry's notice that is showing, and only that one", () => {
    notices(document, [
      [3, "Admin authentication successful"],
      [4, `  ${TEXT.replace(". ", ".\n ")}  `],
    ]);
    const p = page();
    const stop = hideResolutionNotice(p.globals, document);
    expect(p.remove.mock.calls).toEqual([[4]]);
    expect(p.notifications.removed).toEqual([4]);
    expect(p.format).toHaveBeenCalledWith(KEY, { curWidth: 412 });
    stop();
  });

  test("removes it again when Foundry raises it after a resize", async () => {
    notices(document, []);
    const p = page();
    const stop = hideResolutionNotice(p.globals, document);
    add(document, 9, TEXT);
    await Promise.resolve();
    await vi.waitFor(() => {
      expect(p.remove.mock.calls).toEqual([[9]]);
    });
    stop();
    add(document, 10, TEXT);
    await new Promise((r) => setTimeout(r, 0));
    expect(p.remove).toHaveBeenCalledTimes(1);
  });

  test("waits for the notification area when Foundry adds it later (/auth)", async () => {
    const p = page();
    const stop = hideResolutionNotice(p.globals, document);
    notices(document, [[7, TEXT]]);
    await vi.waitFor(() => {
      expect(p.remove.mock.calls).toEqual([[7]]);
    });
    add(document, 8, TEXT);
    // The fake leaves 7 in place, so it is seen again with 8.
    await vi.waitFor(() => {
      expect(p.remove).toHaveBeenLastCalledWith(8);
    });
    stop();
  });

  test("at document start, before the root element exists, it waits instead of failing", async () => {
    const html = document.documentElement;
    html.remove();
    const p = page();
    let stop: () => void = () => undefined;
    try {
      expect(() => {
        stop = hideResolutionNotice(p.globals, document);
      }).not.toThrow();
    } finally {
      document.append(html);
    }
    notices(document, [[11, TEXT]]);
    await vi.waitFor(() => {
      expect(p.remove).toHaveBeenCalledWith(11);
    });
    stop();
  });

  test("stopped before the area comes, it never acts", async () => {
    const p = page();
    hideResolutionNotice(p.globals, document)();
    notices(document, [[7, TEXT]]);
    await new Promise((r) => setTimeout(r, 0));
    expect(p.remove).not.toHaveBeenCalled();
  });

  test("leaves a notice that only looks alike, or isn't permanent", () => {
    notices(document, [[5, "Something else entirely"]]);
    add(document, 6, TEXT, false);
    const p = page();
    hideResolutionNotice(p.globals, document)();
    expect(p.remove).not.toHaveBeenCalled();
  });

  test("does nothing when Foundry reports no such issue", () => {
    notices(document, [[4, TEXT]]);
    const p = page(null);
    hideResolutionNotice(p.globals, document)();
    expect(p.remove).not.toHaveBeenCalled();
  });

  test("an issue without a message key, or no notification area, is harmless", () => {
    const p = page({ params: 1 });
    expect(() => {
      hideResolutionNotice(p.globals, document)();
    }).not.toThrow();
    notices(document, [[4, TEXT]]);
    hideResolutionNotice(page({ message: KEY }).globals, document)();
  });

  test("a Foundry without the pieces it needs is left alone", () => {
    notices(document, [[4, TEXT]]);
    expect(() => {
      hideResolutionNotice({}, document)();
    }).not.toThrow();
  });
});
