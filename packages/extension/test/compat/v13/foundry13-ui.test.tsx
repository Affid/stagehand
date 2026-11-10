// @vitest-environment happy-dom
// Our page on Foundry 13 (docs/FOUNDRY-13-PLAN.md): Shut down through our
// own confirm, Configuration without the settings 13 lacks or certificates,
// and "Foundry has stopped". Deleted with compat/v13/.
import { cleanup, fireEvent, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import type { Choices, ReadOnly, Settings } from "../../../src/page-config.ts";
import { V13_ADAPTER } from "../../../src/compat/v13/adapter.ts";
import { parsePageToUi } from "../../../src/page-protocol.ts";
import { renderUi, setupState } from "../../ui/harness.tsx";

afterEach(cleanup);

const on13 = () => {
  const data = setupState();
  return {
    data: {
      setup: data.setup
        ? {
            ...data.setup,
            core: { version: "13.351", generation: 13, build: 351 },
          }
        : undefined,
    },
    state: {
      adapter: { status: "supported" as const, adapter: V13_ADAPTER },
    },
  };
};

const SETTINGS: Settings & ReadOnly = {
  adminUsername: null,
  dataPath: "/data",
  cssTheme: "dark",
  world: null,
  language: "en.core",
  port: 30000,
  upnp: false,
  unixSocket: null,
  compressStatic: true,
  compressSocket: true,
  sslCert: null,
  sslKey: null,
  awsConfig: null,
  fullscreen: false,
  telemetry: false,
  deleteNEDB: false,
  hotReload: false,
  updateChannel: "stable",
  passwordSet: true,
  running: { port: 30000, unixSocket: null, dataPath: "/data" },
  proxySSL: false,
  noBackups: false,
  electron: false,
  certificate: { managed: false, expired: false, error: null },
};
const CHOICES: Choices = {
  worlds: [],
  languages: [{ value: "en.core", label: "English - Core" }],
  themes: [{ value: "dark", label: "Foundry Virtual Tabletop" }],
  channels: [{ value: "stable", label: "Stable" }],
};

describe("our page on Foundry 13", () => {
  test("Shut down opens our own confirm, not Foundry's missing menu", async () => {
    const r = renderUi("shell", on13());
    fireEvent.click(r.getByRole("button", { name: "Log out or shut down" }));
    fireEvent.click(r.getByRole("button", { name: "Shut down the server" }));
    expect(r.page.foundryAction).not.toHaveBeenCalled();
    const dialog = await r.findByRole("dialog", { name: "Shut down Foundry" });
    fireEvent.click(
      [...dialog.querySelectorAll("button")].find((b) =>
        b.textContent.includes("Shut down Foundry"),
      ) as HTMLElement,
    );
    expect(r.page.foundryAction).toHaveBeenCalledWith({ action: "quit" });
  });

  test("once Foundry has stopped, our confirm gives way to that screen", async () => {
    const r = renderUi("shell", on13());
    fireEvent.click(r.getByRole("button", { name: "Log out or shut down" }));
    fireEvent.click(r.getByRole("button", { name: "Shut down the server" }));
    await r.findByRole("dialog", { name: "Shut down Foundry" });
    r.store.set({ serverStopped: true });
    await r.findByRole("alertdialog", { name: "Foundry has stopped" });
    expect(r.queryByRole("dialog", { name: "Shut down Foundry" })).toBeNull();
  });

  test("on 14, Shut down is still Foundry's own", () => {
    const r = renderUi("shell");
    fireEvent.click(r.getByRole("button", { name: "Log out or shut down" }));
    fireEvent.click(r.getByRole("button", { name: "Shut down the server" }));
    expect(r.page.foundryAction).toHaveBeenCalledWith({ action: "shutdown" });
  });

  test("Configuration leaves out what 13 doesn't have", async () => {
    const r = renderUi("shell", on13());
    r.page.config.mockResolvedValue({ settings: SETTINGS, choices: CHOICES });
    fireEvent.click(r.getByRole("button", { name: "Configuration" }));
    await waitFor(() => {
      expect(r.container.querySelector(".stc-cols")).toBeTruthy();
    });
    expect(r.queryByText("Administrator username")).toBeNull();
    fireEvent.click(r.getByRole("button", { name: "Advanced: compression" }));
    expect(r.queryByText("Unix socket")).toBeNull();
    expect(r.getByText("Compress static files")).toBeTruthy();
  });

  test("Foundry has stopped: over the page, with a way to reload", async () => {
    const r = renderUi("shell", on13());
    r.store.set({ serverStopped: true });
    const screen = await r.findByRole("alertdialog", {
      name: "Foundry has stopped",
    });
    expect(screen.textContent).toContain("Started by hand?");
    expect(r.getByRole("button", { name: "Reload this page" })).toBeTruthy();
    expect(r.container.querySelector(".sts-shell")?.hasAttribute("inert")).toBe(
      true,
    );
  });

  test("the page world's word that Foundry stopped crosses to our page", () => {
    expect(parsePageToUi("SERVER_STOPPED", {})).toEqual({
      type: "SERVER_STOPPED",
      payload: {},
    });
    expect(parsePageToUi("SERVER_STOPPED", { x: 1 })).toBeUndefined();
  });
});
