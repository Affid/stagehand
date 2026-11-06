// @vitest-environment happy-dom
import { cleanup, fireEvent, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import type { Choices, ReadOnly, Settings } from "../../src/page-config.ts";
import { el, renderUi } from "./harness.tsx";

afterEach(cleanup);

const SETTINGS: Settings & ReadOnly = {
  adminUsername: null,
  passwordSet: true,
  world: null,
  language: "en.core",
  cssTheme: "dark",
  port: 30000,
  upnp: true,
  hostname: null,
  routePrefix: null,
  proxyPort: null,
  proxySSL: false,
  dataPath: "/home/gm/foundry/data",
  noBackups: false,
  telemetry: false,
  hotReload: false,
  deleteNEDB: false,
  compressStatic: true,
  compressSocket: true,
  updateChannel: "stable",
};
const CHOICES: Choices = {
  worlds: [{ value: "w1", label: "Strahd" }],
  languages: [{ value: "en.core", label: "English - Core" }],
  themes: [
    { value: "dark", label: "Dark" },
    { value: "light", label: "Light" },
  ],
  channels: [{ value: "stable", label: "Stable" }],
};

async function open() {
  const r = renderUi("shell");
  r.page.config.mockResolvedValue({ settings: SETTINGS, choices: CHOICES });
  fireEvent.click(r.getByRole("button", { name: "Configuration" }));
  await waitFor(() => {
    expect(r.container.querySelector(".mlc-page form")).toBeTruthy();
  });
  return r;
}

describe("the Configuration page", () => {
  test("its heading says what is running: version, port and data folder", async () => {
    const { container } = await open();
    const head = el(container, ".mlc-page .mlb-head");
    expect(head.querySelector("h2")?.textContent).toBe("Configuration");
    expect(head.textContent).toContain("Foundry 14.369");
    expect(head.textContent).toContain("running on port 30000");
    expect(head.querySelector("code")?.textContent).toBe(
      "/home/gm/foundry/data",
    );
  });

  test("the header's Configuration opens it with Foundry's settings, grouped", async () => {
    const { container, store, getByLabelText } = await open();
    expect(store.get().route).toEqual({ kind: "server", page: "config" });
    const groups = [
      ...container.querySelectorAll(".mlc-page fieldset legend"),
    ].map((l) => l.textContent);
    expect(groups).toEqual([
      "Access",
      "Startup and appearance",
      "Network",
      "Data and storage",
      "Other",
    ]);
    expect((getByLabelText("Port") as HTMLInputElement).value).toBe("30000");
    expect(container.textContent).toContain("/home/gm/foundry/data");
    expect(container.textContent).toContain("Set");
  });

  test("edits gather in a bar; Discard puts them back", async () => {
    const { container, getByLabelText, getByRole } = await open();
    fireEvent.input(getByLabelText("Port"), { target: { value: "30001" } });
    expect(el(container, ".mlc-bar").textContent).toContain(
      "1 change not saved",
    );
    fireEvent.click(getByRole("button", { name: "Discard" }));
    expect((getByLabelText("Port") as HTMLInputElement).value).toBe("30000");
    expect(el(container, ".mlc-bar").textContent).not.toContain("not saved");
  });

  test("Save sends only the changes; a restart is explained, with Shut down now", async () => {
    const { container, getByLabelText, getByRole, page } = await open();
    fireEvent.input(getByLabelText("Port"), { target: { value: "30001" } });
    fireEvent.click(getByLabelText("UPnP"));
    page.config.mockResolvedValueOnce({
      settings: { ...SETTINGS, port: 30001, upnp: false },
      choices: CHOICES,
      restart: true,
    });
    fireEvent.click(getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(page.config).toHaveBeenCalledWith("save", {
        port: 30001,
        upnp: false,
      });
    });
    await waitFor(() => {
      expect(el(container, ".mlc-bar").textContent).toContain(
        "after Foundry restarts",
      );
    });
    fireEvent.click(getByRole("button", { name: "Shut down now…" }));
    expect(page.foundryAction).toHaveBeenCalledWith({ action: "shutdown" });
  });

  test("a refused save keeps the edits and says why", async () => {
    const { container, getByLabelText, getByRole, page } = await open();
    fireEvent.input(getByLabelText("Port"), { target: { value: "1" } });
    page.config.mockResolvedValueOnce({ error: "port: invalid" });
    fireEvent.click(getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(container.textContent).toContain("port: invalid");
    });
    expect((getByLabelText("Port") as HTMLInputElement).value).toBe("1");
  });

  test("no way out to Foundry's own Configuration window", async () => {
    const { queryByRole } = await open();
    expect(queryByRole("button", { name: "Change in Foundry" })).toBe(null);
    expect(
      queryByRole("button", { name: "Foundry's Application Configuration" }),
    ).toBe(null);
  });

  test("an out-of-range or empty port is flagged and can't be saved", async () => {
    const { container, getByLabelText, getByRole } = await open();
    fireEvent.input(getByLabelText("Port"), { target: { value: "70000" } });
    expect(container.textContent).toContain("from 1 to 65535");
    expect(
      (getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.input(getByLabelText("Port"), { target: { value: "" } });
    expect(container.textContent).toContain("from 1 to 65535");
    fireEvent.input(getByLabelText("Port"), { target: { value: "30002" } });
    expect(container.textContent).not.toContain("from 1 to 65535");
    expect(
      (getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  test("a later save that needs no restart keeps the earlier restart notice", async () => {
    const { container, getByLabelText, getByRole, page } = await open();
    fireEvent.input(getByLabelText("Port"), { target: { value: "30001" } });
    page.config.mockResolvedValueOnce({
      settings: { ...SETTINGS, port: 30001 },
      choices: CHOICES,
      restart: true,
    });
    fireEvent.click(getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(el(container, ".mlc-bar").textContent).toContain(
        "after Foundry restarts",
      );
    });
    fireEvent.input(getByLabelText("Host name"), {
      target: { value: "gm.example" },
    });
    page.config.mockResolvedValueOnce({
      settings: { ...SETTINGS, port: 30001, hostname: "gm.example" },
      choices: CHOICES,
      restart: false,
    });
    fireEvent.click(getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(el(container, ".mlc-bar").textContent).toContain(
        "after Foundry restarts",
      );
    });
  });

  test("text keeps its spaces while typing and is trimmed when saved", async () => {
    const { getByLabelText, getByRole, page } = await open();
    fireEvent.input(getByLabelText("Host name"), {
      target: { value: "gm.example " },
    });
    expect((getByLabelText("Host name") as HTMLInputElement).value).toBe(
      "gm.example ",
    );
    fireEvent.click(getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(page.config).toHaveBeenCalledWith("save", {
        hostname: "gm.example",
      });
    });
  });
});
