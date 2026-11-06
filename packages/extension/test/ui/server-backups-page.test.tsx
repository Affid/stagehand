// @vitest-environment happy-dom
// The server Backups page as the prototype: a head with the totals and free
// space, tabs Snapshots / Worlds / Modules / Systems with counts and sizes,
// snapshot rows with Select, package lists with filter and sort, Foundry's
// version tags, and the snapshot's progress.
import { cleanup, fireEvent, waitFor, within } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import type { ServerListing } from "../../src/page-server-backups.ts";
import { el, renderUi } from "./harness.tsx";

afterEach(cleanup);

const MB = 1024 * 1024;
const DAY = 864e5;

const snap = (id: string, over: object = {}) => ({
  id,
  createdAt: Date.now() - 35 * DAY,
  size: 131 * MB,
  note: "Before 14.371",
  generation: 14,
  build: 370,
  count: 22,
  ...over,
});

const LISTING: ServerListing = {
  snapshots: [snap("snapshot.1")],
  packages: [
    {
      type: "world",
      id: "w1",
      title: "Strahd",
      installed: true,
      backups: [
        {
          id: "world.w1.1",
          createdAt: Date.now() - 3 * DAY,
          size: 40 * MB,
          snapshot: false,
          verified: "14.370",
        },
      ],
    },
    {
      type: "module",
      id: "old-mod",
      title: "Old Mod",
      installed: false,
      backups: [
        {
          id: "module.old-mod.1",
          createdAt: Date.now() - 9 * DAY,
          size: 2 * MB,
          snapshot: false,
          verified: "13.351",
          version: "2.4.1",
        },
      ],
    },
    {
      type: "module",
      id: "big-mod",
      title: "Big Mod",
      installed: true,
      backups: [
        {
          id: "module.big-mod.1",
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

async function open(listing: ServerListing = LISTING) {
  const r = renderUi("shell");
  r.page.serverBackups.mockResolvedValue({ listing });
  fireEvent.click(r.getByRole("button", { name: "Backups" }));
  await waitFor(() => {
    expect(r.container.querySelector(".mlb-page .mls-subtabs")).toBeTruthy();
  });
  return r;
}

const tabTo = (r: Awaited<ReturnType<typeof open>>, name: string): void => {
  fireEvent.click(r.getByRole("tab", { name: new RegExp(`^${name}`) }));
};

const pkgRow = (c: ParentNode, key: string): HTMLElement =>
  el(c, `.mlb-pkg[data-package="${key}"]`);

describe("the server Backups page", () => {
  test("the head sums up the server's backups, snapshots and free space", async () => {
    const { container, page, store } = await open();
    expect(store.get().route).toEqual({ kind: "server", page: "backups" });
    expect(page.serverBackups).toHaveBeenCalledWith("list", [], true);
    const head = el(container, ".mlb-page .mlb-head");
    expect(head.querySelector("h2")?.textContent).toBe("Backups");
    expect(head.textContent).toContain("51 MB of backups on this server");
    expect(head.textContent).toContain("1 snapshot");
    expect(head.textContent).toContain("48.0 GB of disk free");
  });

  test("four tabs in Foundry's order, with counts and sizes", async () => {
    const { container } = await open();
    const tabs = [...container.querySelectorAll(".mlb-page [role=tab]")].map(
      (x) => x.textContent,
    );
    expect(tabs).toEqual([
      "Snapshots 1",
      "Worlds 1 · 40 MB",
      "Modules 2 · 11 MB",
      "Systems 0 · 0 KB",
    ]);
  });

  test("a snapshot: its note, when, packages, Foundry's build and size", async () => {
    const { container } = await open();
    const s = el(container, '.mlb-snaps li[data-snapshot="snapshot.1"]');
    expect(s.textContent).toContain("Before 14.371");
    expect(s.textContent).toContain("22 packages");
    expect(s.textContent).toContain("5 weeks ago");
    expect(el(s, ".core").textContent).toContain("14.370");
    expect(s.textContent).toContain("131 MB");
    expect(el(container, ".mlb-page .mlw-bhead").textContent).toContain(
      "rolls the whole server back",
    );
  });

  test("Create a snapshot, Restore… and Delete go to Foundry's dialogs", async () => {
    const { container, getByRole, page } = await open();
    fireEvent.click(getByRole("button", { name: "Create a snapshot" }));
    await waitFor(() => {
      expect(page.serverBackups).toHaveBeenCalledWith("createSnapshot", []);
    });
    const s = el(container, '.mlb-snaps li[data-snapshot="snapshot.1"]');
    fireEvent.click(within(s).getByRole("button", { name: "Restore…" }));
    await waitFor(() => {
      expect(page.serverBackups).toHaveBeenCalledWith("restoreSnapshot", [
        "snapshot.1",
      ]);
    });
    fireEvent.click(
      within(s).getByRole("button", {
        name: "Delete the snapshot Before 14.371",
      }),
    );
    await waitFor(() => {
      expect(page.serverBackups).toHaveBeenCalledWith("deleteSnapshots", [
        "snapshot.1",
      ]);
    });
  });

  test("an older snapshot warns; a newer Foundry's can't be restored here", async () => {
    const { container } = await open({
      ...LISTING,
      snapshots: [
        snap("snapshot.old", { generation: 13, build: 351, note: "" }),
        snap("snapshot.new", { generation: 15, build: 300 }),
      ],
    });
    const old = el(container, '[data-snapshot="snapshot.old"]');
    expect(el(old, ".core").classList.contains("warn")).toBe(true);
    const newer = el(container, '[data-snapshot="snapshot.new"]');
    expect(el(newer, ".core").classList.contains("bad")).toBe(true);
    const restore = within(newer).getByRole<HTMLButtonElement>("button", {
      name: "Restore…",
    });
    expect(restore.disabled).toBe(true);
    expect(restore.closest("[title]")?.getAttribute("title")).toContain(
      "can't be restored here",
    );
  });

  test("Select snapshots, then Delete them in one go", async () => {
    const { container, getByRole, page } = await open({
      ...LISTING,
      snapshots: [snap("snapshot.1"), snap("snapshot.2", { note: "Second" })],
    });
    fireEvent.click(getByRole("button", { name: "Select" }));
    for (const id of ["snapshot.1", "snapshot.2"])
      fireEvent.click(
        within(el(container, `[data-snapshot="${id}"]`)).getByRole("checkbox"),
      );
    expect(el(container, ".mlw-bhead.sel").textContent).toContain(
      "2 snapshots selected",
    );
    fireEvent.click(getByRole("button", { name: "Delete 2…" }));
    await waitFor(() => {
      expect(page.serverBackups).toHaveBeenCalledWith("deleteSnapshots", [
        "snapshot.1",
        "snapshot.2",
      ]);
    });
  });

  test("no snapshots yet says what one is", async () => {
    const { container } = await open({ ...LISTING, snapshots: [] });
    expect(el(container, ".mlb-page .mlw-empty").textContent).toContain(
      "No snapshots yet",
    );
  });

  test("an error keeps the listing and shows above it", async () => {
    const { container, getByRole, page } = await open();
    page.serverBackups.mockResolvedValueOnce({
      error: "Not enough disk space",
    });
    fireEvent.click(getByRole("button", { name: "Create a snapshot" }));
    await waitFor(() => {
      expect(container.textContent).toContain("Not enough disk space");
    });
    expect(
      container.querySelector('[data-snapshot="snapshot.1"]'),
    ).toBeTruthy();
  });
});

describe("the Worlds, Modules and Systems tabs", () => {
  test("a world: its backups fold open, Restore latest…, and its own Backups tab", async () => {
    const r = await open();
    tabTo(r, "Worlds");
    const w = pkgRow(r.container, "world:w1");
    expect(w.textContent).toContain("1 backup · latest 3 days ago");
    fireEvent.click(within(w).getByRole("button", { name: "Restore latest…" }));
    await waitFor(() => {
      expect(r.page.backups).toHaveBeenCalledWith(
        "w1",
        "restore",
        ["world.w1.1"],
        "world",
      );
    });
    fireEvent.click(
      within(w).getByRole("button", { name: "Show the backups of Strahd" }),
    );
    expect(w.querySelectorAll(".mlb-inner li")).toHaveLength(1);
    fireEvent.click(
      within(w).getByRole("button", { name: "Open Strahd's Backups tab" }),
    );
    expect(r.store.get().route).toEqual({
      kind: "world",
      worldId: "w1",
      tab: "backups",
    });
  });

  test("a module: its version, not installed, and Delete of one backup", async () => {
    const r = await open();
    tabTo(r, "Modules");
    const m = pkgRow(r.container, "module:old-mod");
    expect(m.textContent).toContain("not installed");
    expect(el(m, ".row .core").textContent).toContain("v2.4.1 · 13.351");
    expect(el(m, ".row .core").classList.contains("warn")).toBe(true);
    fireEvent.click(
      within(m).getByRole("button", { name: "Show the backups of Old Mod" }),
    );
    fireEvent.click(within(m).getByRole("button", { name: /^Delete/ }));
    await waitFor(() => {
      expect(r.page.backups).toHaveBeenCalledWith(
        "old-mod",
        "delete",
        ["module.old-mod.1"],
        "module",
      );
    });
    await waitFor(() => {
      expect(r.page.serverBackups).toHaveBeenLastCalledWith("list", [], true);
    });
  });

  test("filter by name and sort by name, size or latest", async () => {
    const r = await open();
    tabTo(r, "Modules");
    const names = (): string[] =>
      [...r.container.querySelectorAll(".mlb-pkg .nm strong")].map((x) =>
        (x.firstChild?.textContent ?? "").trim(),
      );
    expect(names()).toEqual(["Big Mod", "Old Mod"]);
    expect(el(r.container, ".mlb-tools").textContent).toContain(
      "2 backups of 2 modules · 11 MB",
    );
    fireEvent.change(r.getByRole("combobox", { name: "Sort by" }), {
      target: { value: "latest" },
    });
    expect(names()).toEqual(["Big Mod", "Old Mod"]);
    fireEvent.input(r.getByRole("searchbox", { name: "Filter modules" }), {
      target: { value: "old" },
    });
    expect(names()).toEqual(["Old Mod"]);
    fireEvent.input(r.getByRole("searchbox", { name: "Filter modules" }), {
      target: { value: "zzz" },
    });
    expect(r.container.textContent).toContain("No module matches.");
  });

  test("a failed package operation still shows its error after the list comes back", async () => {
    const r = await open();
    tabTo(r, "Modules");
    r.page.backups.mockResolvedValueOnce({ error: "Backup file missing" });
    fireEvent.click(
      within(pkgRow(r.container, "module:old-mod")).getByRole("button", {
        name: "Restore latest…",
      }),
    );
    await waitFor(() => {
      expect(r.container.textContent).toContain("Backup file missing");
    });
  });
});

describe("a snapshot in progress", () => {
  test("Foundry's steps and the package it is on replace Create a snapshot; the rest waits", async () => {
    const r = await open();
    r.emit({ type: "LOCK", payload: { locked: true } });
    r.emit({
      type: "PROGRESS",
      payload: {
        action: "createSnapshot",
        id: "snapshot.2026-11-06.1",
        type: "snapshot",
        step: "snapshotSystems",
        pct: 50,
      },
    });
    r.emit({
      type: "PROGRESS",
      payload: {
        action: "createBackup",
        id: "system.dnd5e.2026-11-06.1",
        packageId: "dnd5e",
        type: "system",
        title: "Dungeons & Dragons Fifth Edition",
        pct: 10,
      },
    });
    await waitFor(() => {
      expect(r.container.querySelector(".mlb-job")).toBeTruthy();
    });
    const job = el(r.container, ".mlb-job");
    expect(job.getAttribute("role")).toBe("status");
    expect(job.textContent).toContain("Creating a snapshot · 50%");
    expect(job.textContent).toContain(
      "Backing up Dungeons & Dragons Fifth Edition",
    );
    const steps = [...job.querySelectorAll("ol li")].map((x) => x.className);
    expect(steps).toEqual(["done", "now", ""]);
    expect(r.queryByRole("button", { name: "Create a snapshot" })).toBe(null);
    const restore = within(
      el(r.container, '[data-snapshot="snapshot.1"]'),
    ).getByRole<HTMLButtonElement>("button", { name: "Restore…" });
    expect(restore.disabled).toBe(true);
  });
});
