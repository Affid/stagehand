// @vitest-environment happy-dom
import { act } from "preact/test-utils";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createActions, type Send } from "../../src/ui/actions.ts";
import { createTranslator } from "../../src/ui/i18n.ts";
import { SHELL_HOST, syncShell } from "../../src/ui/shell/mount.tsx";
import { createStore } from "../../src/ui/store.ts";
import { fakePage, setupState, uiState } from "./harness.tsx";

afterEach(() => {
  document.body.innerHTML = "";
});

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
  };
  const sync = syncShell(deps, document);
  return { ...fake, store, sync };
}

const turnOn = (store: ReturnType<typeof setup>["store"]): void => {
  store.set((s) => ({ data: { ...s.data, prefs: { newSetupPage: true } } }));
};

const host = (): HTMLElement | null => document.getElementById(SHELL_HOST);

describe("mounting the new Setup page", () => {
  test("off by default: Foundry's page is left alone", () => {
    const { page, sync } = setup();
    sync();
    expect(page.setShell).not.toHaveBeenCalled();
    expect(host()).toBe(null);
  });

  test("turned on: asks the page to hide Foundry's layout, then mounts", () => {
    const { page, store, sync, emit } = setup();
    turnOn(store);
    sync();
    sync();
    expect(page.setShell).toHaveBeenCalledTimes(1);
    expect(page.setShell).toHaveBeenCalledWith(true);
    expect(host()).toBe(null);
    emit({ type: "SHELL_STATE", payload: { on: true } });
    expect(host()?.querySelector(".mls-top")).toBeTruthy();
  });

  test("the page refusing keeps today's UI and says why, once", () => {
    const { page, store, sync, emit } = setup();
    turnOn(store);
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
  });

  test("turned off: unmounts and gives Foundry's layout back", () => {
    const { page, store, sync, emit } = setup();
    turnOn(store);
    sync();
    emit({ type: "SHELL_STATE", payload: { on: true } });
    store.set((s) => ({ data: { ...s.data, prefs: { newSetupPage: false } } }));
    sync();
    expect(host()).toBe(null);
    expect(page.setShell).toHaveBeenLastCalledWith(false);
  });

  test("safe mode never takes over the page", () => {
    const { page, store, sync } = setup({ adapter: { status: "safe-mode" } });
    turnOn(store);
    sync();
    expect(page.setShell).not.toHaveBeenCalled();
  });

  test("a late acknowledgement of off doesn't spoil turning on again", () => {
    const { page, store, sync, emit } = setup();
    turnOn(store);
    sync();
    emit({ type: "SHELL_STATE", payload: { on: true } });
    store.set((s) => ({ data: { ...s.data, prefs: { newSetupPage: false } } }));
    sync();
    turnOn(store);
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
  test("gives Foundry's layout back and keeps today's UI", async () => {
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
      },
      document,
    );
    turnOn(store);
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
    };
    const sync = sync2(deps, document);
    turnOn(store);
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
