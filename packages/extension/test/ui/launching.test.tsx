// @vitest-environment happy-dom
// Launching a world (Android plan, phase 7): our screen from the tap, with
// Foundry's own launch steps as they come, its error in our words, and the
// app's way back to the servers. Foundry draws all of it in its hidden Setup.
import type { Snapshot } from "@stagehand/shared/world";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, test, vi } from "vitest";
import { parseProgress } from "../../src/page-progress.ts";
import type { ExtensionMessage } from "../../src/messages.ts";
import {
  launchView,
  type Launching,
  withLaunchTick,
} from "../../src/ui/launching.ts";
import { renderUi, setupState } from "./harness.tsx";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const START: Launching = { worldId: "w1", title: "Strahd", backup: false };
const tick = (over: object) =>
  parseProgress({ action: "launchWorld", id: "w1", ...over })!;

describe("Foundry's launch ticks", () => {
  test("are kept, with the error text Foundry sends when it fails", () => {
    expect(
      parseProgress({ action: "launchWorld", id: "w1", step: "connectWorld" }),
    ).toMatchObject({ action: "launchWorld", id: "w1", step: "connectWorld" });
    expect(
      parseProgress({
        action: "launchWorld",
        id: "w1",
        step: "error",
        error: "The world is locked",
      }),
    ).toMatchObject({ step: "error", error: "The world is locked" });
  });

  test("a tick keeps what it doesn't say (review)", () => {
    const moved = withLaunchTick(
      START,
      tick({ step: "connectWorld", pct: 40 }),
    );
    expect(withLaunchTick(moved, tick({ step: "connectWorld" }))).toMatchObject(
      {
        step: "connectWorld",
        pct: 40,
      },
    );
  });

  test("move the launch on; another world's ticks don't", () => {
    const moved = withLaunchTick(
      START,
      tick({ step: "connectWorld", pct: 40 }),
    );
    expect(moved).toMatchObject({ step: "connectWorld", pct: 40 });
    expect(withLaunchTick(START, { ...tick({}), id: "w2" })).toBe(START);
    expect(withLaunchTick(null, tick({ step: "connectWorld" }))).toBeNull();
  });

  test("the view: asking, then loading with Foundry's step, then opening", () => {
    expect(launchView(START)).toMatchObject({ stage: "ask", pct: 5 });
    const loading = launchView(
      withLaunchTick(START, tick({ step: "connectWorld", pct: 50 }))!,
    );
    expect(loading).toMatchObject({ stage: "load", detail: "connectWorld" });
    expect(loading.pct).toBeGreaterThan(30);
    expect(loading.pct).toBeLessThan(70);
    expect(
      launchView(withLaunchTick(START, tick({ step: "complete" }))!),
    ).toMatchObject({ stage: "open", pct: 100 });
    expect(launchView({ ...START, backup: true })).toMatchObject({
      stage: "backup",
    });
  });
});

const snap = (worldId: string, active: string[]): Snapshot => ({
  worldId,
  title: worldId,
  system: { id: "dnd5e", version: "5" },
  coreVersion: "14.369",
  active: active.map((id) => ({ id, version: "1.0.0" })),
  companionVersion: "0.1.0",
  takenAt: "2026-11-09T00:00:00.000Z",
});

function launchPage(app = false) {
  const data = { snapshots: { w1: snap("w1", ["stagehand", "a"]) } };
  const full = setupState(data);
  const reply = (m: ExtensionMessage): unknown =>
    m.kind === "get-state"
      ? full
      : m.kind === "world-queue"
        ? { queue: [] }
        : undefined;
  const r = renderUi("shell", {
    data,
    reply,
    state: { route: { kind: "world", worldId: "w1" } },
    app,
  });
  fireEvent.click(r.getByRole("button", { name: /^Launch/ }));
  return r;
}

describe("the launching screen", () => {
  test("shows at the tap, then follows Foundry's steps", async () => {
    const r = launchPage();
    const dialog = await screen.findByRole("dialog", {
      name: "Launching Strahd",
    });
    expect(dialog.textContent).toContain("Asking Foundry to launch");
    r.emit({
      type: "PROGRESS",
      payload: tick({ step: "connectWorld", pct: 40 }),
    });
    await waitFor(() => {
      expect(dialog.textContent).toContain("Reading the world's data");
    });
    r.emit({ type: "PROGRESS", payload: tick({ step: "complete", pct: 100 }) });
    await waitFor(() => {
      expect(dialog.textContent).toContain("Foundry is ready");
    });
  });

  test("Foundry's error says why, and Back to the world closes it", async () => {
    const r = launchPage();
    await screen.findByRole("dialog", { name: "Launching Strahd" });
    r.emit({
      type: "PROGRESS",
      payload: tick({ step: "error", error: "The world is locked" }),
    });
    expect(await screen.findByText(/The world is locked/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back to the world" }));
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Launching Strahd" }),
      ).toBeNull();
    });
    expect(r.store.get().launching).toBeNull();
  });

  test("no answer from Foundry for a while: it says so and offers the way back", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    launchPage();
    await screen.findByRole("dialog", { name: "Launching Strahd" });
    expect(screen.queryByText(/hasn't started/)).toBeNull();
    vi.advanceTimersByTime(21_000);
    expect(await screen.findByText(/hasn't started/)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Back to the world" }),
    ).toBeTruthy();
  });

  test("a launch that goes quiet after a tick still offers the way back (review)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const r = launchPage();
    await screen.findByRole("dialog", { name: "Launching Strahd" });
    r.emit({
      type: "PROGRESS",
      payload: tick({ step: "connectWorld", pct: 10 }),
    });
    vi.advanceTimersByTime(60_000);
    // Still within the loading limit: no note yet.
    expect(
      screen.queryByRole("button", { name: "Back to the world" }),
    ).toBeNull();
    r.emit({
      type: "PROGRESS",
      payload: tick({ step: "connectWorld", pct: 20 }),
    });
    vi.advanceTimersByTime(60_000);
    expect(
      screen.queryByRole("button", { name: "Back to the world" }),
    ).toBeNull();
    vi.advanceTimersByTime(31_000);
    expect(await screen.findByText(/gone quiet/)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Back to the world" }),
    ).toBeTruthy();
  });

  test("the page behind is out of reach; Escape goes back once Back is offered", async () => {
    const r = launchPage();
    const dialog = await screen.findByRole("dialog", {
      name: "Launching Strahd",
    });
    expect(r.container.querySelector(".sts-shell")?.hasAttribute("inert")).toBe(
      true,
    );
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(r.store.get().launching).not.toBeNull();
    r.emit({ type: "PROGRESS", payload: tick({ step: "error", error: "No" }) });
    await screen.findByRole("alert");
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => {
      expect(r.store.get().launching).toBeNull();
    });
    expect(r.container.querySelector(".sts-shell")?.hasAttribute("inert")).toBe(
      false,
    );
  });

  test("in the app, Server list opens the servers; the extension has none", async () => {
    const app = launchPage(true);
    await screen.findByRole("dialog", { name: "Launching Strahd" });
    fireEvent.click(screen.getByRole("button", { name: "Server list" }));
    await waitFor(() => {
      expect(app.send).toHaveBeenCalledWith({ kind: "open-settings" });
    });
    cleanup();
    launchPage(false);
    await screen.findByRole("dialog", { name: "Launching Strahd" });
    expect(screen.queryByRole("button", { name: "Server list" })).toBeNull();
  });
});
