// @vitest-environment happy-dom
import { act } from "preact/test-utils";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createActions, type Send } from "../../src/ui/actions.ts";
import { createTranslator } from "../../src/ui/i18n.ts";
import { SHELL_HOST, syncShell } from "../../src/ui/shell/mount.tsx";
import { createStore } from "../../src/ui/store.ts";
import {
  fakePage,
  fakePorts,
  SUPPORTED,
  setupState,
  uiState,
} from "./harness.tsx";

afterEach(() => {
  document.body.innerHTML = "";
  document.documentElement.className = "";
});

/** Foundry's own Setup shown again (the veil lifted). */
const foundryShown = (): boolean =>
  document.documentElement.classList.contains("ml-shell-off");

function setup(over: Parameters<typeof uiState>[0] = {}) {
  const store = createStore(uiState(over));
  const t = createTranslator("en");
  const fake = fakePage();
  const send = vi.fn(() => Promise.resolve(undefined)) as unknown as Send;
  const deps = {
    store,
    t,
    page: fake.page,
    actions: createActions(store, send, t, fake.page),
    ports: fakePorts(),
  };
  const sync = syncShell(deps, document);
  return { ...fake, store, sync, ports: deps.ports };
}

/** The extension can't change the page any more (safe mode), or can again. */
const safeMode = (
  store: ReturnType<typeof setup>["store"],
  on: boolean,
): void => {
  store.set(on ? { adapter: { status: "safe-mode" } } : { adapter: SUPPORTED });
};

const host = (): HTMLElement | null => document.getElementById(SHELL_HOST);

describe("mounting the new Setup page", () => {
  test("on by default: asks the page to hide Foundry's layout, then mounts", () => {
    const { page, sync, emit } = setup();
    sync();
    sync();
    expect(page.setShell).toHaveBeenCalledTimes(1);
    expect(page.setShell).toHaveBeenCalledWith(true);
    expect(host()).toBe(null);
    emit({ type: "SHELL_STATE", payload: { on: true } });
    expect(host()?.querySelector(".mls-top")).toBeTruthy();
  });

  test("links to other sites on the page go to the host's openExternal", () => {
    const { sync, emit, ports } = setup();
    sync();
    emit({ type: "SHELL_STATE", payload: { on: true } });
    const link = document.createElement("a");
    link.href = "https://foundryvtt.com/article";
    link.target = "_blank";
    host()?.append(link);
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    // As the user's own click (happy-dom lets a test say so).
    Object.defineProperty(click, "isTrusted", { value: true });
    expect(link.dispatchEvent(click)).toBe(false);
    expect(ports.openExternal).toHaveBeenCalledWith(
      "https://foundryvtt.com/article",
    );
  });

  test("the page refusing leaves Foundry's page and says why, once", () => {
    const { page, sync, emit } = setup();
    sync();
    emit({
      type: "SHELL_STATE",
      payload: { on: false, error: "Foundry's #setup is missing" },
    });
    sync();
    expect(host()).toBe(null);
    expect(page.setShell).toHaveBeenCalledTimes(1);
    expect(page.notify).toHaveBeenCalledWith(
      "error",
      expect.stringContaining("#setup"),
    );
    expect(foundryShown()).toBe(true);
  });

  test("safe mode later: unmounts and gives Foundry's layout back", () => {
    const { page, store, sync, emit } = setup();
    sync();
    emit({ type: "SHELL_STATE", payload: { on: true } });
    safeMode(store, true);
    sync();
    expect(host()).toBe(null);
    expect(page.setShell).toHaveBeenLastCalledWith(false);
  });

  test("safe mode never takes over the page, and shows Foundry's at once", () => {
    const { page, sync } = setup({ adapter: { status: "safe-mode" } });
    sync();
    expect(page.setShell).not.toHaveBeenCalled();
    expect(foundryShown()).toBe(true);
  });

  test("taking over keeps Foundry's page out of sight", () => {
    const { sync, emit } = setup();
    sync();
    emit({ type: "SHELL_STATE", payload: { on: true } });
    expect(foundryShown()).toBe(false);
  });

  test("a late acknowledgement of off doesn't spoil turning on again", () => {
    const { page, store, sync, emit } = setup();
    sync();
    emit({ type: "SHELL_STATE", payload: { on: true } });
    safeMode(store, true);
    sync();
    safeMode(store, false);
    sync();
    emit({ type: "SHELL_STATE", payload: { on: false } });
    emit({ type: "SHELL_STATE", payload: { on: true } });
    expect(host()?.querySelector(".mls-top")).toBeTruthy();
    expect(page.notify).not.toHaveBeenCalled();
  });

  test("an answer nobody asked for is ignored", () => {
    const { emit } = setup({ data: setupState() });
    emit({ type: "SHELL_STATE", payload: { on: true } });
    expect(host()).toBe(null);
  });
});

describe("a render error", () => {
  test("gives Foundry's layout back", async () => {
    vi.resetModules();
    vi.doMock("../../src/ui/App.tsx", () => ({
      ShellRoot: () => {
        throw new Error("boom");
      },
    }));
    const { syncShell: sync2, SHELL_HOST: id } =
      await import("../../src/ui/shell/mount.tsx");
    const store = createStore(uiState());
    const t = createTranslator("en");
    const fake = fakePage();
    const send = vi.fn(() => Promise.resolve(undefined)) as unknown as Send;
    const sync = sync2(
      {
        store,
        t,
        page: fake.page,
        actions: createActions(store, send, t, fake.page),
        ports: fakePorts(),
      },
      document,
    );

    sync();
    fake.emit({ type: "SHELL_STATE", payload: { on: true } });
    expect(document.getElementById(id)).toBe(null);
    expect(fake.page.setShell).toHaveBeenLastCalledWith(false);
    expect(fake.page.notify).toHaveBeenCalledWith(
      "error",
      expect.stringContaining("boom"),
    );
    vi.doUnmock("../../src/ui/App.tsx");
  });
});

describe("an error after the page is up", () => {
  test("also gives Foundry's layout back", async () => {
    vi.resetModules();
    vi.doMock("../../src/ui/shell/Shell.tsx", async () => {
      const { useUi } = await import("../../src/ui/context.ts");
      return {
        Shell: () => {
          const { state } = useUi();
          if (state.route?.kind === "library") throw new Error("late boom");
          return <div class="mls-top" />;
        },
      };
    });
    const { syncShell: sync2, SHELL_HOST: id } =
      await import("../../src/ui/shell/mount.tsx");
    const store = createStore(uiState());
    const t = createTranslator("en");
    const fake = fakePage();
    const send = vi.fn(() => Promise.resolve(undefined)) as unknown as Send;
    const deps = {
      store,
      t,
      page: fake.page,
      actions: createActions(store, send, t, fake.page),
      ports: fakePorts(),
    };
    const sync = sync2(deps, document);

    sync();
    void act(() => {
      fake.emit({ type: "SHELL_STATE", payload: { on: true } });
    });
    expect(document.getElementById(id)).toBeTruthy();
    void act(() => {
      store.set({ route: { kind: "library" } });
    });
    await vi.waitFor(() => {
      expect(document.getElementById(id)).toBe(null);
    });
    expect(fake.page.setShell).toHaveBeenLastCalledWith(false);
    expect(fake.page.notify).toHaveBeenCalledWith(
      "error",
      expect.stringContaining("late boom"),
    );
    vi.doUnmock("../../src/ui/shell/Shell.tsx");
  });
});
