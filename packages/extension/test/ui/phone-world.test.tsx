// @vitest-environment happy-dom
// A world's page in the phone layout (Android plan, phase 3, package 3):
// the bottom bar, the Next launch sheet, the short tab count, the tools
// outside the pinned row.
import type { Command, Snapshot } from "@module-library/shared/world";
import { cleanup, fireEvent, waitFor, within } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ExtensionMessage, SetupState } from "../../src/messages.ts";
import { el, renderUi, sent, setupState } from "./harness.tsx";

const happy = () =>
  (
    window as unknown as {
      happyDOM: { setViewport(v: { width: number; height: number }): void };
    }
  ).happyDOM;

beforeEach(() => {
  happy().setViewport({ width: 412, height: 915 });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  happy().setViewport({ width: 1024, height: 768 });
});

const snap = (active: string[]): Snapshot => ({
  worldId: "w1",
  title: "w1",
  system: { id: "dnd5e", version: "5" },
  coreVersion: "14.369",
  active: active.map((id) => ({ id, version: "1.0.0" })),
  companionVersion: "0.1.0",
  takenAt: "2026-11-05T00:00:00.000Z",
});

const cmd = (modules: string[]): Command => ({
  id: "c1",
  scope: "world",
  worldId: "w1",
  type: "preset.apply",
  payload: { mode: "add", presetIds: [], modules },
  createdAt: new Date(Date.now() - 60_000).toISOString(),
  baseSnapshotAt: null,
  status: "pending",
});

function world(over: Partial<SetupState> = {}) {
  const data: Partial<SetupState> = {
    snapshots: { w1: snap(["stagehand", "a"]) },
    ...over,
  };
  const r = renderUi("shell", {
    data,
    reply: (m: ExtensionMessage) =>
      m.kind === "get-state" ? setupState(data) : { ok: true },
    state: {
      route: { kind: "world", worldId: "w1" },
      phone: { home: false, trail: [], at: null },
    },
  });
  return r;
}

const dock = (c: Element) => el(c, ".mlp-dock");

describe("a world's bottom bar on a phone", () => {
  test("no changes: what's on now, and Launch; the banner's own are gone", () => {
    const { container } = world();
    const bar = dock(container);
    expect(bar.textContent).toContain("No changes");
    expect(bar.textContent).toContain("2 modules on");
    expect(within(bar).getByRole("button", { name: /^Launch/ })).toBeTruthy();
    expect(
      within(bar).queryByRole("button", { name: /See or undo/ }),
    ).toBeNull();
  });

  test("queued changes: the count opens Next launch; Launch has a badge", () => {
    const { container, store } = world({ commands: [cmd(["b"])] });
    const bar = dock(container);
    expect(bar.querySelector(".mlp-what strong")?.textContent).toContain(
      "1 change",
    );
    expect(bar.querySelector(".mlc-badge")?.textContent).toBe("1");
    fireEvent.click(within(bar).getByRole("button", { name: /See or undo/ }));
    expect(store.get().nextLaunch).toBe("w1");
  });

  test("a world not set up says so", () => {
    const { container } = world({ snapshots: {} });
    expect(dock(container).textContent).toContain("Modules unknown");
    expect(dock(container).textContent).toContain("Set up on the first launch");
  });

  test("a locked world can't launch, and says why", () => {
    const base = setupState();
    const { container } = world({
      setup: base.setup
        ? {
            ...base.setup,
            worlds: base.setup.worlds.map((w) => ({ ...w, locked: true })),
          }
        : undefined,
    });
    const launch = within(dock(container)).getByRole("button", {
      name: /^Launch/,
    });
    expect((launch as HTMLButtonElement).disabled).toBe(true);
    expect(launch.parentElement?.getAttribute("title")).toContain("Locked");
  });
});

describe("the Next launch sheet", () => {
  test("lists the changes, and Discard all asks the background", async () => {
    const r = world({ commands: [cmd(["b"])] });
    fireEvent.click(
      within(dock(r.container)).getByRole("button", { name: /See or undo/ }),
    );
    const sheet = await waitFor(() =>
      r.getByRole("dialog", { name: "Next launch" }),
    );
    expect(sheet.textContent).toContain("This change applies when");
    expect(within(sheet).getByRole("button", { name: /^Drop / })).toBeTruthy();
    fireEvent.click(within(sheet).getByRole("button", { name: "Discard all" }));
    expect(r.store.get().nextLaunch).toBeNull();
    await waitFor(() => {
      expect(
        sent(r.send).some(
          (m) => (m as { kind?: string }).kind === "cancel-command",
        ),
      ).toBe(true);
    });
  });

  test("its Launch closes it and goes through the review", async () => {
    const r = world({ commands: [cmd(["b"])] });
    fireEvent.click(
      within(dock(r.container)).getByRole("button", { name: /See or undo/ }),
    );
    const sheet = await waitFor(() =>
      r.getByRole("dialog", { name: "Next launch" }),
    );
    fireEvent.click(within(sheet).getByRole("button", { name: /^Launch/ }));
    expect(r.store.get().nextLaunch).toBeNull();
  });

  test("Escape closes it first", () => {
    const r = world({ commands: [cmd(["b"])] });
    r.store.set({ nextLaunch: "w1" });
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", cancelable: true }),
    );
    expect(r.store.get().nextLaunch).toBeNull();
    expect(r.store.get().phone.home).toBe(false);
  });
});

describe("the tab row on a phone", () => {
  test("the Modules count reads now → after launch", async () => {
    const { container } = world({ commands: [cmd(["b"])] });
    await waitFor(() => {
      expect(
        container.querySelector('.mls-subtabs [role="tab"] .c')?.textContent,
      ).toBe("2 → 3");
    });
  });

  test("the tools sit under the pinned row, not in it", () => {
    const { container } = world();
    expect(container.querySelector(".mls-subtabs .mlc-tools")).toBeNull();
    expect(
      container.querySelector(".mls-body-main > .mlc-tools"),
    ).not.toBeNull();
  });
});

describe("review fixes", () => {
  const locked = () => {
    const base = setupState();
    return base.setup
      ? {
          ...base.setup,
          worlds: base.setup.worlds.map((w) => ({ ...w, locked: true })),
        }
      : undefined;
  };

  test("Next launch's Launch keeps the bar's rule: a locked world can't launch", async () => {
    const r = world({ commands: [cmd(["b"])], setup: locked() });
    r.store.set({ nextLaunch: "w1" });
    const sheet = await waitFor(() =>
      r.getByRole("dialog", { name: "Next launch" }),
    );
    const launch = within(sheet).getByRole("button", { name: /^Launch/ });
    expect((launch as HTMLButtonElement).disabled).toBe(true);
    expect(launch.parentElement?.getAttribute("title")).toContain("Locked");
  });

  test("a sheet left for a world that's gone closes, and nothing stays inert", async () => {
    const r = world({ commands: [cmd(["b"])] });
    r.store.set({ nextLaunch: "gone" });
    await waitFor(() => {
      expect(r.store.get().nextLaunch).toBeNull();
    });
    expect(r.container.querySelector<HTMLElement>(".mls-main")?.inert).toBe(
      false,
    );
  });

  test("the short count is said in words", async () => {
    const { container } = world({ commands: [cmd(["b"])] });
    await waitFor(() => {
      expect(
        container.querySelector('.mls-subtabs [role="tab"] .ml-sr-only')
          ?.textContent,
      ).toBe("2 now, 3 after launch");
    });
  });
});
