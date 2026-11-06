// @vitest-environment happy-dom
import type { Command, Snapshot } from "@module-library/shared/world";
import { cleanup, fireEvent, waitFor, within } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import type { ExtensionMessage, SetupState } from "../../src/messages.ts";
import { el, renderUi, sent, setupState } from "./harness.tsx";

afterEach(cleanup);

const snap = (worldId: string, active: string[]): Snapshot => ({
  worldId,
  title: worldId,
  system: { id: "dnd5e", version: "5" },
  coreVersion: "14.369",
  active: active.map((id) => ({ id, version: "1.0.0" })),
  companionVersion: "0.1.0",
  takenAt: "2026-11-05T00:00:00.000Z",
});

const cmd = (
  id: string,
  mode: "add" | "remove" | "replace",
  over: { presetIds?: string[]; modules?: string[] },
): Command => ({
  id,
  scope: "world",
  worldId: "w1",
  type: "preset.apply",
  payload: {
    mode,
    presetIds: over.presetIds ?? [],
    ...(over.modules ? { modules: over.modules } : {}),
  },
  createdAt: "2026-11-05T01:00:00.000Z",
  baseSnapshotAt: null,
  status: "pending",
});

const base = setupState();
const worlds = [
  ...(base.setup?.worlds ?? []),
  {
    id: "w2",
    title: "Vaults",
    system: "dnd5e",
    systemVersion: "5",
    coreVersion: "14.369",
  },
];

function page(over: Partial<SetupState> = {}) {
  const data: Partial<SetupState> = {
    setup: base.setup ? { ...base.setup, worlds } : undefined,
    snapshots: {
      w1: snap("w1", ["module-library", "a"]),
      w2: snap("w2", ["module-library", "c", "lib"]),
    },
    ...over,
  };
  const full = setupState(data);
  const reply = (m: ExtensionMessage): unknown =>
    m.kind === "get-state"
      ? full
      : m.kind === "queue-apply"
        ? { queued: "n" }
        : undefined;
  return renderUi("shell", {
    data,
    reply,
    state: { route: { kind: "world", worldId: "w1" } },
  });
}

const card = (c: ParentNode, id: string): HTMLElement =>
  el(c, `.mlw-card[data-module="${id}"]`);
const toggle = (c: ParentNode, id: string): HTMLInputElement =>
  el(card(c, id), 'input[role="switch"]') as HTMLInputElement;

describe("the Modules tab", () => {
  test("cards are grouped by folder, with a switch per module", () => {
    const { container } = page();
    const groups = [...container.querySelectorAll(".mlw-sec .name")].map(
      (n) => n.textContent,
    );
    expect(groups).toEqual(["Combat", "Unfiled"]);
    expect(toggle(container, "a").checked).toBe(true);
    expect(toggle(container, "b").checked).toBe(false);
    expect(toggle(container, "a").getAttribute("aria-label")).toBe(
      "Title a on in Strahd",
    );
    expect(toggle(container, "module-library").disabled).toBe(true);
    expect(card(container, "module-library").textContent).toContain(
      "Always on",
    );
  });

  test("a card's name opens the module's details beside the page, this world marked", () => {
    const { getByRole, container } = page();
    fireEvent.click(getByRole("button", { name: "Title a" }));
    const panel = getByRole("complementary", { name: "Title a" });
    expect(panel.parentElement).toBe(el(container, ".mls"));
    const here = el(panel, ".mls-wlist li.mls-here");
    expect(here.textContent).toContain("Strahd");
    expect(here.textContent).toContain("this world");
  });

  test("each card says why in one line", () => {
    const { container } = page();
    expect(card(container, "a").textContent).toContain("for Strahd");
    // Verified for Foundry 13: a risk on 14, marked like Foundry's warning.
    expect(card(container, "b").textContent).toContain(
      "Not verified for Foundry 14",
    );
    expect(card(container, "b").textContent).not.toContain("14.369");
    expect(card(container, "b").classList.contains("risk")).toBe(true);
    expect(card(container, "a").classList.contains("risk")).toBe(false);
    expect(card(container, "c").textContent).toContain("By Ann");
  });

  test("flipping a switch queues that module for the next launch", async () => {
    const { container, send } = page();
    fireEvent.click(toggle(container, "b"));
    await waitFor(() => {
      expect(sent(send)).toContainEqual({
        kind: "queue-apply",
        worldId: "w1",
        mode: "add",
        presetIds: [],
        modules: ["b"],
      });
    });
  });

  test("flipping back undoes the queued change", async () => {
    const { container, send } = page({
      commands: [cmd("c9", "add", { modules: ["b"] })],
    });
    expect(card(container, "b").textContent).toContain("turns on");
    expect(card(container, "b").className).toContain("plus");
    fireEvent.click(toggle(container, "b"));
    await waitFor(() => {
      expect(sent(send)).toContainEqual({ kind: "cancel-command", id: "c9" });
    });
    expect(sent(send)).not.toContainEqual(
      expect.objectContaining({ kind: "queue-apply" }),
    );
  });

  test("a problem offers its fix", async () => {
    const { container, send } = page({
      snapshots: { w1: snap("w1", ["module-library", "c", "lib"]) },
      commands: [cmd("c1", "remove", { modules: ["lib"] })],
    });
    const lib = card(container, "lib");
    expect(lib.classList.contains("prob")).toBe(true);
    fireEvent.click(within(lib).getByRole("button", { name: "Turn it on" }));
    await waitFor(() => {
      expect(sent(send)).toContainEqual({ kind: "cancel-command", id: "c1" });
    });
  });

  test("All / On / Changes and the filter narrow the cards", () => {
    const { container, getByRole } = page({
      commands: [cmd("c1", "add", { modules: ["b"] })],
    });
    const shown = () =>
      [...container.querySelectorAll(".mlw-card")].map((c) =>
        c.getAttribute("data-module"),
      );
    fireEvent.click(getByRole("button", { name: /^Changes/ }));
    expect(shown()).toEqual(["b"]);
    fireEvent.click(getByRole("button", { name: /^On/ }));
    expect(shown().sort()).toEqual(["a", "b", "module-library"]);
    fireEvent.click(getByRole("button", { name: /^All/ }));
    fireEvent.input(getByRole("searchbox", { name: "Filter modules" }), {
      target: { value: "title c" },
    });
    expect(shown()).toEqual(["c"]);
  });

  test("Add: a preset queues it for the next launch", async () => {
    const { getByRole, send } = page();
    fireEvent.click(getByRole("button", { name: "Add" }));
    fireEvent.click(getByRole("button", { name: "Preset: QoL" }));
    await waitFor(() => {
      expect(sent(send)).toContainEqual({
        kind: "queue-apply",
        worldId: "w1",
        mode: "add",
        presetIds: ["p1"],
      });
    });
  });

  test("Add: copy another world's modules, matching it", async () => {
    const { getByRole, send } = page();
    fireEvent.click(getByRole("button", { name: "Add" }));
    fireEvent.click(getByRole("button", { name: "Copy from Vaults" }));
    fireEvent.click(getByRole("button", { name: "Match Vaults" }));
    await waitFor(() => {
      expect(sent(send)).toContainEqual({
        kind: "queue-apply",
        worldId: "w1",
        mode: "replace",
        presetIds: [],
        modules: ["c", "lib"],
      });
    });
  });
});

describe("the banner and launching", () => {
  test("queued changes show in the banner and on Launch; Discard cancels them", async () => {
    const { container, getByRole, send } = page({
      commands: [
        cmd("c1", "add", { modules: ["b"] }),
        cmd("c2", "remove", { modules: ["a"] }),
      ],
    });
    const banner = el(container, ".mls-banner");
    expect(banner.textContent).toContain("2 changes wait for the next launch");
    expect(el(banner, ".mlc-badge").textContent).toBe("2");
    fireEvent.click(getByRole("button", { name: "Discard" }));
    await waitFor(() => {
      expect(sent(send)).toEqual(
        expect.arrayContaining([
          { kind: "cancel-command", id: "c1" },
          { kind: "cancel-command", id: "c2" },
        ]),
      );
    });
  });

  test("with nothing queued, Launch launches", () => {
    const { getByRole, page: p } = page();
    fireEvent.click(getByRole("button", { name: /^Launch/ }));
    expect(p.foundryAction).toHaveBeenCalledWith({
      action: "launch",
      worldId: "w1",
    });
  });

  test("with changes, Launch opens the review; apply backs up first, then launches", async () => {
    const {
      getByRole,
      send,
      page: p,
    } = page({
      commands: [cmd("c1", "add", { modules: ["b"] })],
    });
    fireEvent.click(getByRole("button", { name: /^Launch/ }));
    const dialog = getByRole("dialog", { name: "Launch Strahd" });
    expect(dialog.textContent).toContain("Turns on · 1");
    expect(dialog.textContent).toContain("Title b");
    const backup = within(dialog).getByRole<HTMLInputElement>("checkbox", {
      name: /Back up Strahd first/,
    });
    expect(backup.checked).toBe(true);
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Apply 1 change and launch" }),
    );
    await waitFor(() => {
      expect(p.foundryAction).toHaveBeenCalledWith({
        action: "backupLaunch",
        worldId: "w1",
        note: "Before queued changes (Module Library)",
      });
    });
    // The review is the confirmation: the result goes with the launch.
    expect(sent(send)).toContainEqual({
      kind: "launch-hold",
      worldId: "w1",
      hold: false,
      reviewed: expect.arrayContaining(["b"]) as unknown,
    });
  });

  test("unticking Back up first launches straight away", async () => {
    const { getByRole, page: p } = page({
      commands: [cmd("c1", "add", { modules: ["b"] })],
    });
    fireEvent.click(getByRole("button", { name: /^Launch/ }));
    const dialog = getByRole("dialog", { name: "Launch Strahd" });
    fireEvent.click(
      within(dialog).getByRole("checkbox", { name: /Back up Strahd first/ }),
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Apply 1 change and launch" }),
    );
    await waitFor(() => {
      expect(p.foundryAction).toHaveBeenCalledWith({
        action: "launch",
        worldId: "w1",
      });
    });
  });

  test("Launch without changes holds the queue for this launch", async () => {
    const {
      getByRole,
      send,
      page: p,
    } = page({
      commands: [cmd("c1", "add", { modules: ["b"] })],
    });
    fireEvent.click(getByRole("button", { name: /^Launch/ }));
    fireEvent.click(getByRole("button", { name: "Launch without changes" }));
    await waitFor(() => {
      expect(p.foundryAction).toHaveBeenCalledWith({
        action: "launch",
        worldId: "w1",
      });
    });
    expect(sent(send)).toContainEqual({
      kind: "launch-hold",
      worldId: "w1",
      hold: true,
    });
  });

  test("Cancel closes the review without launching", () => {
    const {
      getByRole,
      queryByRole,
      page: p,
    } = page({
      commands: [cmd("c1", "add", { modules: ["b"] })],
    });
    fireEvent.click(getByRole("button", { name: /^Launch/ }));
    fireEvent.click(getByRole("button", { name: "Cancel" }));
    expect(queryByRole("dialog")).toBe(null);
    expect(p.foundryAction).not.toHaveBeenCalled();
  });
});

describe("a world without the companion", () => {
  test("explains the one-time setup instead of showing switches", () => {
    const { container, getByRole, page: p } = page({ snapshots: {} });
    expect(container.querySelector(".mlw-card")).toBe(null);
    expect(container.textContent).toContain(
      "Module Library isn't set up in Strahd yet",
    );
    fireEvent.click(getByRole("button", { name: "Launch to set it up" }));
    expect(p.foundryAction).toHaveBeenCalledWith({
      action: "launch",
      worldId: "w1",
    });
  });
});

describe("review findings", () => {
  test("a read-only browser still launches from the review, without a hold", async () => {
    const {
      getByRole,
      queryByRole,
      send,
      page: p,
    } = page({
      adminVerified: false,
      commands: [cmd("c1", "add", { modules: ["b"] })],
    });
    fireEvent.click(getByRole("button", { name: /^Launch/ }));
    expect(queryByRole("button", { name: "Launch without changes" })).toBe(
      null,
    );
    fireEvent.click(getByRole("checkbox", { name: /Back up Strahd first/ }));
    fireEvent.click(getByRole("button", { name: "Apply 1 change and launch" }));
    await waitFor(() => {
      expect(p.foundryAction).toHaveBeenCalledWith({
        action: "launch",
        worldId: "w1",
      });
    });
    expect(sent(send)).not.toContainEqual(
      expect.objectContaining({ kind: "launch-hold" }),
    );
  });

  test("a queued change that changes nothing still shows, can be discarded and is reviewed", async () => {
    const { container, getByRole, send } = page({
      commands: [cmd("c1", "add", { modules: ["a"] })],
    });
    const banner = el(container, ".mls-banner");
    expect(banner.textContent).toContain("1 queued change changes nothing");
    fireEvent.click(getByRole("button", { name: /^Launch/ }));
    expect(getByRole("dialog", { name: "Launch Strahd" })).toBeTruthy();
    fireEvent.click(getByRole("button", { name: "Cancel" }));
    fireEvent.click(getByRole("button", { name: "Discard" }));
    await waitFor(() => {
      expect(sent(send)).toContainEqual({ kind: "cancel-command", id: "c1" });
    });
  });

  test("a second flip while the first is saving is ignored", async () => {
    const { container, send } = page();
    fireEvent.click(toggle(container, "b"));
    fireEvent.click(toggle(container, "b"));
    await waitFor(() => {
      expect(
        sent(send).filter(
          (m) => (m as { kind: string }).kind === "queue-apply",
        ),
      ).toHaveLength(1);
    });
  });

  test("the review takes focus, and Escape gives it back to Launch", () => {
    const { getByRole, queryByRole } = page({
      commands: [cmd("c1", "add", { modules: ["b"] })],
    });
    const launch = getByRole("button", { name: /^Launch/ });
    launch.focus();
    fireEvent.click(launch);
    const dialog = getByRole("dialog", { name: "Launch Strahd" });
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document.activeElement ?? document, { key: "Escape" });
    expect(queryByRole("dialog")).toBe(null);
    expect(document.activeElement).toBe(launch);
  });

  test("copy says how many modules, and refuses more than a change can hold", () => {
    const many = Array.from({ length: 501 }, (_, i) => `m${String(i)}`);
    const { getByRole } = page({
      snapshots: {
        w1: snap("w1", ["module-library", "a"]),
        w2: snap("w2", ["module-library", ...many]),
      },
    });
    fireEvent.click(getByRole("button", { name: "Add" }));
    const copy = getByRole("button", { name: "Copy from Vaults" });
    expect(copy.textContent).toContain("501 modules");
    fireEvent.click(copy);
    const match = getByRole("button", {
      name: "Match Vaults",
    }) as HTMLButtonElement;
    expect(match.disabled).toBe(true);
    expect(match.closest(".mlw-addstep")?.textContent).toContain("500");
  });
});
