// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from "vitest";
import { V14_SELECTORS } from "../../src/adapters/config.ts";
import { createTranslator } from "../../src/ui/i18n.ts";
import { worldRows } from "../../src/ui/model/worlds.ts";
import { syncWorldTags, tagView } from "../../src/ui/worlds/tags.ts";
import { setupState } from "./harness.tsx";
import { pending, snapshot, W2 } from "./worlds-fixtures.ts";

const t = createTranslator("en");

afterEach(() => {
  document.body.innerHTML = "";
});

function cards(...ids: string[]): void {
  document.body.innerHTML = `<ol id="worlds-list">${ids
    .map(
      (id) =>
        `<li class="package world" data-package-id="${id}"><div class="tags flexrow right"><span class="tag">dnd5e</span></div></li>`,
    )
    .join("")}</ol>`;
}

const rowsOf = (over = {}) => {
  const base = setupState();
  return worldRows({
    ...base,
    setup: { ...base.setup!, worlds: [...base.setup!.worlds, W2] },
    ...over,
  });
};

describe("status tag on Foundry's world cards", () => {
  test("says queued, failed, outdated, out of date, not tracked or the count", () => {
    const now = Date.now();
    const view = (over: object) => tagView(rowsOf(over)[0]!, t, now);
    expect(view({ commands: [pending] })).toMatchObject({
      tone: "info",
      label: "1 queued",
    });
    expect(
      view({ commands: [{ ...pending, status: "failed", error: "Boom" }] }),
    ).toMatchObject({ tone: "error", label: "Failed", tooltip: "Boom" });
    expect(
      view({
        hellos: {
          w1: { worldId: "w1", moduleVersion: "0", protocol: null, at: "t" },
        },
      }),
    ).toMatchObject({ tone: "warn", label: "Outdated" });
    expect(view({})).toMatchObject({ tone: "muted", label: "Not tracked" });
    expect(view({ snapshots: { w1: snapshot() } })).toMatchObject({
      tone: "ok",
      label: "2",
      tooltip: "Tracked: 2 active modules, snapshot just now",
    });
  });

  test("goes first in the card's tags, updates in place, opens the sheet", () => {
    cards("w1", "w2", "unknown");
    const open = vi.fn();
    syncWorldTags(document, V14_SELECTORS, rowsOf(), t, open);
    const tag = document.querySelector<HTMLButtonElement>(
      '[data-package-id="w1"] .ml-world-tag',
    )!;
    expect(tag.parentElement?.firstElementChild).toBe(tag);
    expect(tag.textContent).toBe("Not tracked");
    expect(tag.getAttribute("aria-label")).toMatch(
      /^Not tracked: Module Library status of Strahd\. /,
    );
    expect(document.querySelectorAll(".ml-world-tag")).toHaveLength(2);
    syncWorldTags(
      document,
      V14_SELECTORS,
      rowsOf({ commands: [pending] }),
      t,
      open,
    );
    expect(document.querySelectorAll(".ml-world-tag")).toHaveLength(2);
    expect(tag.textContent).toBe("1 queued");
    const launch = vi.fn();
    tag.closest("li")!.addEventListener("click", launch);
    tag.click();
    expect(open).toHaveBeenCalledWith("w1");
    expect(launch).not.toHaveBeenCalled();
  });

  test("removes tags of worlds that went away", () => {
    cards("w1");
    syncWorldTags(document, V14_SELECTORS, rowsOf(), t, vi.fn());
    syncWorldTags(document, V14_SELECTORS, [], t, vi.fn());
    expect(document.querySelector(".ml-world-tag")).toBeNull();
  });
});
