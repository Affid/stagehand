// @vitest-environment happy-dom
// The server pages in the phone layout (Android plan, phase 3, package 5):
// Backups' summary and New snapshot in the dock, one row of tabs, selecting
// snapshots in the dock, dates without the weekday; Configuration's bar in
// the dock.
import type { Choices, ReadOnly, Settings } from "../../src/page-config.ts";
import type { ServerListing } from "../../src/page-server-backups.ts";
import { cleanup, fireEvent, waitFor, within } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { el, renderUi } from "./harness.tsx";

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
  happy().setViewport({ width: 1024, height: 768 });
});

const MB = 1024 * 1024;
const DAY = 864e5;
const SNAP_AT = Date.now() - 35 * DAY;

const snap = (id: string) => ({
  id,
  createdAt: SNAP_AT,
  size: 131 * MB,
  generation: 14,
  build: 370,
  count: 22,
});

const LISTING: ServerListing = {
  snapshots: [snap("snapshot.1"), snap("snapshot.2")],
  packages: [
    {
      type: "module",
      id: "m1",
      title: "Mod",
      installed: true,
      backups: [
        {
          id: "module.m1.1",
          createdAt: Date.now() - DAY,
          size: 9 * MB,
          snapshot: false,
          verified: "14.370",
          version: "1.0.0",
        },
      ],
    },
  ],
  free: 48 * 1024 * MB,
};

async function backups() {
  const r = renderUi("shell", {
    state: {
      route: { kind: "server", page: "backups" },
      phone: { home: false, trail: [], at: null },
    },
    answers: (page) => {
      page.serverBackups.mockResolvedValue({ listing: LISTING });
    },
  });
  await waitFor(() => {
    expect(r.container.querySelector(".mlb-page .mls-subtabs")).toBeTruthy();
  });
  return r;
}

const dock = (c: Element) => el(c, ".mlp-dock");

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

describe("Backups on a phone", () => {
  test("the summary and New snapshot sit in the dock, not in a head", async () => {
    const r = await backups();
    expect(r.container.querySelector(".mlb-page .mlb-head")).toBeNull();
    const bar = el(r.container, ".mlp-dock .mlp-bkbar");
    expect(bar.textContent).toContain("2 snapshots");
    expect(bar.textContent).toContain("48.0 GB of disk free");
    fireEvent.click(within(bar).getByRole("button", { name: /New snapshot/ }));
    await waitFor(() => {
      expect(r.getByRole("dialog", { name: "Create a snapshot" })).toBeTruthy();
    });
  });

  test("a package tab's bar counts its backups and their size", async () => {
    const r = await backups();
    fireEvent.click(r.getByRole("tab", { name: /^Modules/ }));
    const bar = el(r.container, ".mlp-dock .mlp-bkbar");
    expect(bar.textContent).toContain("1 backup");
    expect(bar.textContent).toContain("9 MB");
  });

  test("one row of tabs: names and counts, no sizes", async () => {
    const r = await backups();
    const names = [
      ...r.container.querySelectorAll('.mls-main [role="tab"]'),
    ].map((t) => t.textContent.replace(/\s+/g, " ").trim());
    expect(names).toEqual([
      "Snapshots 2",
      "Worlds 0",
      "Modules 1",
      "Systems 0",
    ]);
  });

  test("the note is one line, and dates have no weekday", async () => {
    const r = await backups();
    expect(el(r.container, ".mlw-bhead").textContent).toContain(
      "Restoring one rolls the whole server back.",
    );
    const weekday = new Date(SNAP_AT).toLocaleDateString(undefined, {
      weekday: "long",
    });
    expect(el(r.container, ".mlb-snaps .nm").textContent).not.toContain(
      weekday,
    );
  });

  test("selecting snapshots: the count, Delete and Done take over the dock", async () => {
    const r = await backups();
    fireEvent.click(
      within(el(r.container, ".mlw-bhead")).getByRole("button", {
        name: /Select/,
      }),
    );
    const sel = el(r.container, ".mlp-dock .mlp-bksel");
    expect(sel.textContent).toContain("to delete");
    expect(within(sel).getByRole("button", { name: /Delete/ })).toBeTruthy();
    fireEvent.click(within(sel).getByRole("button", { name: "Done" }));
    await waitFor(() => {
      expect(r.container.querySelector(".mlp-dock .mlp-bksel")).toBeNull();
    });
  });
});

describe("Configuration on a phone", () => {
  test("its unsaved bar goes into the dock", async () => {
    const r = renderUi("shell", {
      state: {
        route: { kind: "server", page: "config" },
        phone: { home: false, trail: [], at: null },
      },
      answers: (page) => {
        page.config.mockResolvedValue({ settings: SETTINGS, choices: CHOICES });
      },
    });
    const field = await waitFor(() =>
      r.getByRole("textbox", { name: /username/i }),
    );
    fireEvent.input(field, { target: { value: "someone" } });
    await waitFor(() => {
      expect(dock(r.container).querySelector(".mlc-bar")).not.toBeNull();
    });
    expect(r.container.querySelector(".mls-main .mlc-bar")).toBeNull();
  });
});
