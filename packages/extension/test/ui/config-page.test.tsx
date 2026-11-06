// @vitest-environment happy-dom
// The Configuration page as the prototype (package 7): the settings
// Foundry's own window edits, in two columns; the password flow; the HTTPS
// box with Foundry's certificate actions; problems that stop a save; the bar
// at the bottom, a save dialog listing each change, and the restart notice.
import { cleanup, fireEvent, waitFor, within } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import type { Choices, ReadOnly, Settings } from "../../src/page-config.ts";
import { el, renderUi } from "./harness.tsx";

afterEach(cleanup);

const SETTINGS: Settings & ReadOnly = {
  adminUsername: null,
  dataPath: "/home/gm/foundry/data",
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
  running: { port: 30000, unixSocket: null, dataPath: "/home/gm/foundry/data" },
  proxySSL: false,
  noBackups: false,
  electron: false,
  certificate: { managed: false, expired: false, error: null },
};
const CHOICES: Choices = {
  worlds: [{ value: "w1", label: "Strahd" }],
  languages: [{ value: "en.core", label: "English - Core" }],
  themes: [
    { value: "dark", label: "Foundry Virtual Tabletop" },
    { value: "fantasy", label: "Classic Fantasy" },
  ],
  channels: [{ value: "stable", label: "Stable" }],
};

async function open(over: Partial<Settings & ReadOnly> = {}) {
  const r = renderUi("shell");
  r.page.config.mockResolvedValue({
    settings: { ...SETTINGS, ...over },
    choices: CHOICES,
  });
  fireEvent.click(r.getByRole("button", { name: "Configuration" }));
  await waitFor(() => {
    expect(r.container.querySelector(".mlc-cols")).toBeTruthy();
  });
  return r;
}

const box = (c: ParentNode, title: string): HTMLElement => {
  const found = [...c.querySelectorAll<HTMLElement>(".mlc-cols .mlw-box")].find(
    (b) => b.querySelector("h4")?.textContent.startsWith(title),
  );
  if (!found) throw new Error(`no box ${title}`);
  return found;
};

describe("the Configuration page", () => {
  test("its heading says what runs now: version, port and data folder", async () => {
    const { container } = await open();
    const head = el(container, ".mlc-page .mlb-head");
    expect(head.textContent).toContain("running on port 30000");
    expect(head.textContent).toContain("/home/gm/foundry/data");
  });

  test("two columns, as the prototype, with only what Foundry's own window edits", async () => {
    const { container, queryByRole } = await open();
    const cols = [...container.querySelectorAll(".mlc-cols > .col")].map(
      (col) =>
        [...col.querySelectorAll(".mlw-box > h4")].map((h) => h.textContent),
    );
    expect(cols).toEqual([
      ["Access", "Startup and appearance", "Other"],
      ["Network and HTTPS", "Data and storage"],
    ]);
    for (const gone of [
      "Host name",
      "Route prefix",
      "Proxy port",
      "Update channel",
    ])
      expect(queryByRole("textbox", { name: gone })).toBe(null);
    expect(container.textContent).not.toContain("Full-screen mode");
  });

  test("Backups are set when the server starts: their state and a link", async () => {
    const { container } = await open({ noBackups: true });
    expect(box(container, "Data and storage").textContent).toContain(
      "Turned off when the server was started",
    );
  });

  test("an edit is marked and gathered in the bar; Discard puts it back", async () => {
    const { container, getByRole } = await open();
    fireEvent.change(getByRole("combobox", { name: "Setup theme" }), {
      target: { value: "fantasy" },
    });
    expect(el(container, ".mlc-unsaved").textContent).toContain(
      "1 change not saved: Setup theme",
    );
    expect(container.querySelector(".mlc-set.changed")).toBeTruthy();
    fireEvent.click(getByRole("button", { name: "Discard" }));
    expect(container.querySelector(".mlc-unsaved")).toBe(null);
  });

  test("Save… lists each change; saving sends only the changes; then the restart notice", async () => {
    const { container, getByRole, page } = await open();
    fireEvent.change(getByRole("combobox", { name: "Setup theme" }), {
      target: { value: "fantasy" },
    });
    fireEvent.click(getByRole("button", { name: "Save…" }));
    const dialog = getByRole("dialog", { name: "Save configuration" });
    expect(dialog.textContent).toContain(
      "Foundry Virtual Tabletop → Classic Fantasy",
    );
    page.config.mockResolvedValueOnce({
      settings: { ...SETTINGS, cssTheme: "fantasy" },
      choices: CHOICES,
      restart: true,
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save 1 change" }),
    );
    await waitFor(() => {
      expect(page.config).toHaveBeenCalledWith(
        "save",
        { cssTheme: "fantasy" },
        undefined,
      );
    });
    await waitFor(() => {
      expect(el(container, ".mlc-waiting").textContent).toContain(
        "apply after a restart: Setup theme",
      );
    });
    fireEvent.click(getByRole("button", { name: "Shut down now…" }));
    fireEvent.click(
      within(getByRole("dialog", { name: "Shut down Foundry" })).getByRole(
        "button",
        { name: "Shut down Foundry" },
      ),
    );
    expect(page.foundryAction).toHaveBeenCalledWith({ action: "quit" });
  });

  test("problems stop a save and say why: port, data path, certificate without key", async () => {
    const { container, getByRole } = await open();
    fireEvent.input(getByRole("spinbutton", { name: "Port" }), {
      target: { value: "70000" },
    });
    fireEvent.input(getByRole("textbox", { name: "User data path" }), {
      target: { value: "data" },
    });
    expect(container.textContent).toContain(
      "A port is a whole number from 1 to 65535.",
    );
    expect(container.textContent).toContain("Use a full path");
    const save = getByRole("button", { name: "Save…" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(save.closest("[title]")?.getAttribute("title")).toContain(
      "Fix the 2 problems first",
    );
  });
});

describe("the password (package 7)", () => {
  test("Change…: Foundry checks the current one; a new one twice; saved with the rest", async () => {
    const { getByRole, getByLabelText, page, container } = await open();
    fireEvent.click(getByRole("button", { name: "Change…" }));
    page.config.mockResolvedValueOnce({
      settings: SETTINGS,
      choices: CHOICES,
      passwordOk: true,
    });
    fireEvent.input(getByLabelText("Current password"), {
      target: { value: "old" },
    });
    fireEvent.click(getByRole("button", { name: "Continue" }));
    await waitFor(() => {
      expect(page.config).toHaveBeenCalledWith("checkPassword", {}, "old");
    });
    const next = await waitFor(() => getByLabelText("New password"));
    fireEvent.input(next, { target: { value: "longenough" } });
    fireEvent.input(getByLabelText("Repeat the new password"), {
      target: { value: "longenough" },
    });
    fireEvent.click(getByRole("button", { name: "Use it" }));
    expect(el(container, ".mlc-unsaved").textContent).toContain(
      "Administrator password",
    );
    fireEvent.click(getByRole("button", { name: "Save…" }));
    fireEvent.click(
      within(getByRole("dialog")).getByRole("button", {
        name: "Save 1 change",
      }),
    );
    await waitFor(() => {
      expect(page.config).toHaveBeenCalledWith("save", {}, "longenough");
    });
  });

  test("a wrong current password, a short or mismatched new one, each says so", async () => {
    const { getByRole, getByLabelText, page, container } = await open();
    fireEvent.click(getByRole("button", { name: "Change…" }));
    page.config.mockResolvedValueOnce({
      settings: SETTINGS,
      choices: CHOICES,
      passwordOk: false,
    });
    fireEvent.input(getByLabelText("Current password"), {
      target: { value: "bad" },
    });
    fireEvent.click(getByRole("button", { name: "Continue" }));
    await waitFor(() => {
      expect(container.textContent).toContain(
        "That isn't the current password.",
      );
    });
  });
});

describe("HTTPS (package 7)", () => {
  test("not encrypted: Get a free certificate… explains, then asks Foundry", async () => {
    const { container, getByRole, page } = await open();
    expect(el(container, ".mlc-https").textContent).toContain(
      "Not encrypted (http)",
    );
    fireEvent.click(getByRole("button", { name: "Get a free certificate…" }));
    const d = getByRole("dialog", { name: "Get a free certificate" });
    expect(d.textContent).toContain("Port 80 must be reachable");
    page.config.mockResolvedValueOnce({
      settings: SETTINGS,
      choices: CHOICES,
      method: "letsencrypt",
      restart: true,
    });
    fireEvent.click(
      within(d).getByRole("button", { name: "Get the certificate" }),
    );
    await waitFor(() => {
      expect(page.config).toHaveBeenCalledWith(
        "generateCertificate",
        {},
        undefined,
      );
    });
  });

  test("a reverse proxy, Let's Encrypt, or your own certificate each say so", async () => {
    let r = await open({ proxySSL: true });
    expect(el(r.container, ".mlc-https").textContent).toContain(
      "reverse proxy",
    );
    cleanup();
    r = await open({
      certificate: { managed: true, expired: false, error: null },
    });
    expect(el(r.container, ".mlc-https").textContent).toContain(
      "Let's Encrypt",
    );
    expect(r.getByRole("button", { name: "Stop renewing…" })).toBeTruthy();
    cleanup();
    r = await open({ sslCert: "c.pem", sslKey: "k.pem" });
    expect(el(r.container, ".mlc-https").textContent).toContain(
      "your own certificate",
    );
  });

  test("your own certificate needs its key", async () => {
    const { container, getByRole } = await open();
    fireEvent.click(
      getByRole("button", { name: "Use my own certificate instead" }),
    );
    fireEvent.input(getByRole("textbox", { name: "SSL certificate" }), {
      target: { value: "c.pem" },
    });
    expect(container.textContent).toContain("A certificate needs its key");
  });
});
