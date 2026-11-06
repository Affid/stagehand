// @vitest-environment happy-dom
import { cleanup, fireEvent, waitFor, within } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import type { ServerListing } from "../../src/page-server-backups.ts";
import { el, renderUi } from "./harness.tsx";

afterEach(cleanup);

const LISTING: ServerListing = {
  snapshots: [
    {
      id: "snapshot.1",
      createdAt: Date.parse("2026-11-01T10:00:00Z"),
      size: 131 * 1024 * 1024,
      note: "Before 14.371",
      generation: 14,
      build: 370,
      count: 22,
    },
  ],
  packages: [
    {
      type: "world",
      id: "w1",
      title: "Strahd",
      installed: true,
      backups: [
        {
          id: "world.w1.1",
          createdAt: 3,
          size: 40 * 1024 * 1024,
          snapshot: false,
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
          createdAt: 2,
          size: 2 * 1024 * 1024,
          snapshot: false,
        },
      ],
    },
  ],
};

async function open(listing: ServerListing = LISTING) {
  const r = renderUi("shell");
  r.page.serverBackups.mockResolvedValue({ listing });
  fireEvent.click(r.getByRole("button", { name: "Backups" }));
  await waitFor(() => {
    expect(r.container.querySelector(".mlb-page .mlb-snaps")).toBeTruthy();
  });
  return r;
}

describe("the server Backups page", () => {
  test("the header's Backups opens it, in Foundry's order of categories", async () => {
    const { container, store } = await open();
    expect(store.get().route).toEqual({ kind: "server", page: "backups" });
    const heads = [...container.querySelectorAll(".mlb-sec > h3")].map(
      (h) => h.textContent,
    );
    expect(heads[0]).toMatch(/^Snapshots/);
    expect(heads.slice(1).map((h) => h.split(" ")[0])).toEqual([
      "Worlds",
      "Modules",
    ]);
  });

  test("snapshots show their note, Foundry version and size", async () => {
    const { container } = await open();
    const snap = el(container, '.mlb-snaps li[data-snapshot="snapshot.1"]');
    expect(snap.textContent).toContain("Before 14.371");
    expect(snap.textContent).toContain("14.370");
    expect(snap.textContent).toContain("131 MB");
    expect(snap.textContent).toContain("22");
  });

  test("Take a snapshot, restore and delete one go to Foundry's dialogs", async () => {
    const { container, getByRole, page } = await open();
    fireEvent.click(getByRole("button", { name: "Take a snapshot" }));
    await waitFor(() => {
      expect(page.serverBackups).toHaveBeenCalledWith("createSnapshot", []);
    });
    const snap = el(container, '.mlb-snaps li[data-snapshot="snapshot.1"]');
    fireEvent.click(within(snap).getByRole("button", { name: "Restore" }));
    await waitFor(() => {
      expect(page.serverBackups).toHaveBeenCalledWith("restoreSnapshot", [
        "snapshot.1",
      ]);
    });
    fireEvent.click(within(snap).getByRole("button", { name: "Delete" }));
    await waitFor(() => {
      expect(page.serverBackups).toHaveBeenCalledWith("deleteSnapshots", [
        "snapshot.1",
      ]);
    });
  });

  test("a package's backups open inline; an uninstalled one says restoring reinstalls it", async () => {
    const { container, page } = await open();
    const mod = el(container, '.mlb-pkg[data-package="module:old-mod"]');
    expect(mod.textContent).toContain("Not installed");
    fireEvent.click(within(mod).getByRole("button", { name: /Old Mod/ }));
    fireEvent.click(within(mod).getByRole("button", { name: "Delete" }));
    await waitFor(() => {
      expect(page.backups).toHaveBeenCalledWith(
        "old-mod",
        "delete",
        ["module.old-mod.1"],
        "module",
      );
    });
    await waitFor(() => {
      expect(page.serverBackups).toHaveBeenLastCalledWith("list", []);
    });
  });

  test("no way out to Foundry's Backup Manager", async () => {
    const { queryByRole } = await open();
    expect(queryByRole("button", { name: "Foundry's Backup Manager" })).toBe(
      null,
    );
  });

  test("an error keeps the listing and shows above it", async () => {
    const { container, getByRole, page } = await open();
    page.serverBackups.mockResolvedValueOnce({
      error: "Not enough disk space",
    });
    fireEvent.click(getByRole("button", { name: "Take a snapshot" }));
    await waitFor(() => {
      expect(container.textContent).toContain("Not enough disk space");
    });
    expect(
      container.querySelector('[data-snapshot="snapshot.1"]'),
    ).toBeTruthy();
  });

  test("a failed package operation still shows its error after the list comes back", async () => {
    const { container, page } = await open();
    page.backups.mockResolvedValueOnce({ error: "Backup file missing" });
    const mod = el(container, '.mlb-pkg[data-package="module:old-mod"]');
    fireEvent.click(within(mod).getByRole("button", { name: /Old Mod/ }));
    fireEvent.click(within(mod).getByRole("button", { name: "Restore" }));
    await waitFor(() => {
      expect(page.serverBackups).toHaveBeenLastCalledWith("list", []);
    });
    await waitFor(() => {
      expect(container.textContent).toContain("Backup file missing");
    });
  });
});
